import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
} from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("debug-templi")
  .setDescription("Mostra il match ruoli↔canali per il riepilogo templi (solo admin)")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2018\u2019\u201a\u201b\u2032\u2035\u0060\u00b4]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const guild = interaction.guild;
  if (!guild) { await interaction.editReply("❌ Solo in un server."); return; }

  try { await guild.members.fetch(); } catch {
    await interaction.editReply("❌ Impossibile fetchare i membri — controlla che l'intent **GuildMembers** sia abilitato nel Developer Portal del bot.");
    return;
  }

  // Collect text channels (excluding threads)
  const channelByNorm = new Map<string, string>(); // normalizzato → nome originale
  for (const [, ch] of guild.channels.cache) {
    if (ch.isTextBased() && !ch.isThread()) {
      channelByNorm.set(normalize(ch.name), ch.name);
    }
  }

  // Collect roles (excluding @everyone)
  const roles = guild.roles.cache.filter((r) => r.name !== "@everyone");

  const lines: string[] = [
    `**Debug riepilogo templi**`,
    `Canali testo trovati: **${channelByNorm.size}**`,
    `Ruoli trovati: **${roles.size}** (escluso @everyone)`,
    ``,
    `**Match ruolo → canale:**`,
  ];

  let matchCount = 0;
  for (const [, role] of roles) {
    const normRole = normalize(role.name);
    const matchedChannel = channelByNorm.get(normRole);
    const memberCount = role.members.size;
    if (matchedChannel) {
      lines.push(`✅ \`${role.name}\` (${normRole}) → #${matchedChannel} — ${memberCount} membri nel ruolo`);
      matchCount++;
    } else {
      lines.push(`❌ \`${role.name}\` (${normRole}) → nessun canale corrispondente`);
    }
  }

  lines.push(``, `**Totale match: ${matchCount}**`);

  if (matchCount === 0) {
    lines.push(
      ``,
      `⚠️ **Nessun match trovato.** Assicurati che il nome del ruolo corrisponda al nome del canale.`,
      `Esempio: ruolo \`Tempio 1\` → canale \`#tempio-1\` (dopo normalizzazione entrambi diventano \`tempio1\`)`,
    );
  }

  const text = lines.join("\n");
  // Discord message limit is 2000 chars; split if needed
  if (text.length <= 2000) {
    await interaction.editReply({ content: text });
  } else {
    const chunks: string[] = [];
    let chunk = "";
    for (const line of lines) {
      if (chunk.length + line.length + 1 > 1990) { chunks.push(chunk); chunk = ""; }
      chunk += (chunk ? "\n" : "") + line;
    }
    if (chunk) chunks.push(chunk);
    await interaction.editReply({ content: chunks[0] });
    for (const c of chunks.slice(1)) await interaction.followUp({ content: c, ephemeral: true });
  }
}
