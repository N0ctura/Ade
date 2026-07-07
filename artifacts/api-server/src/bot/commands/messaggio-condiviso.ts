import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
  type TextBasedChannel,
} from "discord.js";

const EDIT_BUTTON_PREFIX = "sharedmsg:edit";
const EDIT_MODAL_PREFIX = "sharedmsg:modal";
const EDIT_TEXT_INPUT_ID = "shared_message_content";

export const data = new SlashCommandBuilder()
  .setName("messaggio-condiviso")
  .setDescription("Invia un messaggio del bot modificabile da tutti gli amministratori")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption((opt) =>
    opt
      .setName("testo")
      .setDescription("Testo iniziale del messaggio")
      .setRequired(true)
      .setMaxLength(2000)
  );

function isAdmin(interaction: ButtonInteraction | ModalSubmitInteraction): boolean {
  return interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ?? false;
}

function buildButtonCustomId(channelId: string, messageId: string): string {
  return `${EDIT_BUTTON_PREFIX}:${channelId}:${messageId}`;
}

function buildModalCustomId(channelId: string, messageId: string): string {
  return `${EDIT_MODAL_PREFIX}:${channelId}:${messageId}`;
}

function buildEditButtonRow(channelId: string, messageId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(buildButtonCustomId(channelId, messageId))
      .setLabel("Modifica")
      .setStyle(ButtonStyle.Secondary)
  );
}

function parseTargetFromCustomId(customId: string, prefix: string): { channelId: string; messageId: string } | null {
  if (!customId.startsWith(`${prefix}:`)) return null;
  const [, , channelId, messageId] = customId.split(":");
  if (!channelId || !messageId) return null;
  return { channelId, messageId };
}

async function fetchTargetMessage(
  interaction: ButtonInteraction | ModalSubmitInteraction,
  channelId: string,
  messageId: string
) {
  const channel = await interaction.client.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased()) return null;

  const textChannel = channel as TextBasedChannel;
  const message = await textChannel.messages.fetch(messageId).catch(() => null);
  if (!message || message.author.id !== interaction.client.user?.id) return null;

  return { channel: textChannel, message };
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const testo = interaction.options.getString("testo", true);
  const channel = interaction.channel;

  if (!channel?.isTextBased()) {
    await interaction.reply({
      content: "❌ Questo comando può essere usato solo in un canale testuale.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const sentMessage = await channel.send({ content: testo });
  await sentMessage.edit({
    components: [buildEditButtonRow(channel.id, sentMessage.id)],
  });

  await interaction.reply({
    content: `✅ Messaggio condiviso inviato in <#${channel.id}>.`,
    flags: MessageFlags.Ephemeral,
  });
}

export async function handleButtonInteraction(interaction: ButtonInteraction): Promise<void> {
  const target = parseTargetFromCustomId(interaction.customId, EDIT_BUTTON_PREFIX);
  if (!target) return;

  if (!isAdmin(interaction)) {
    await interaction.reply({
      content: "❌ Solo gli amministratori possono modificare questo messaggio.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const targetMessage = await fetchTargetMessage(interaction, target.channelId, target.messageId);
  if (!targetMessage) {
    await interaction.reply({
      content: "❌ Messaggio non trovato o non più modificabile.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(buildModalCustomId(target.channelId, target.messageId))
    .setTitle("Modifica Messaggio");

  const textInput = new TextInputBuilder()
    .setCustomId(EDIT_TEXT_INPUT_ID)
    .setLabel("Nuovo testo")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(2000)
    .setValue(targetMessage.message.content || "");

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(textInput)
  );

  await interaction.showModal(modal);
}

export async function handleModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
  const target = parseTargetFromCustomId(interaction.customId, EDIT_MODAL_PREFIX);
  if (!target) return;

  if (!isAdmin(interaction)) {
    await interaction.reply({
      content: "❌ Solo gli amministratori possono modificare questo messaggio.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const targetMessage = await fetchTargetMessage(interaction, target.channelId, target.messageId);
  if (!targetMessage) {
    await interaction.reply({
      content: "❌ Messaggio non trovato o non più modificabile.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const newText = interaction.fields.getTextInputValue(EDIT_TEXT_INPUT_ID).trim();
  await targetMessage.message.edit({
    content: newText,
    components: [buildEditButtonRow(target.channelId, target.messageId)],
  });

  await interaction.reply({
    content: "✅ Messaggio aggiornato.",
    flags: MessageFlags.Ephemeral,
  });
}
