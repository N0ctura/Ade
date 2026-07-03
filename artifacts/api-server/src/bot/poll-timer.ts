import {
  type Client,
  type Guild,
  type TextChannel,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  EmbedBuilder,
  AttachmentBuilder,
} from "discord.js";
import { logger } from "../lib/logger.js";
import { loadConfig, saveConfig, getMessages, type ActivePoll } from "./storage.js";
import { normalize } from "./normalize.js";
import { loadImage } from "@napi-rs/canvas";

let activeTimer: ReturnType<typeof setTimeout> | null = null;

export function schedulePollClose(client: Client, closesAt: string): void {
  if (activeTimer !== null) { clearTimeout(activeTimer); activeTimer = null; }
  const msLeft = new Date(closesAt).getTime() - Date.now();
  if (msLeft <= 0) { void closePoll(client); return; }
  logger.info({ closesAt, msLeft }, "Timer sondaggio programmato");
  activeTimer = setTimeout(() => { activeTimer = null; void closePoll(client); }, msLeft);
}

export function cancelPollTimer(): void {
  if (activeTimer !== null) { clearTimeout(activeTimer); activeTimer = null; logger.info("Timer sondaggio annullato"); }
}

const RIMESCOLO_IDX = -1;
const EMBED_COLOR = 0x8b0000;
const EMBED_FIELD_MAX = 1000;

interface VoteResult {
  winners: number[];
  maxVotes: number;
  voterMap: Map<string, string>;
}

function countVotes(poll: ActivePoll): VoteResult {
  const votes = poll.votes ?? {};
  const voteCounts = new Array<number>(poll.questCount + 1).fill(0);
  const voterMap = new Map<string, string>();

  for (const [userId, v] of Object.entries(votes)) {
    const questIdx = v as number;
    if (questIdx === RIMESCOLO_IDX) {
      voteCounts[poll.questCount] = (voteCounts[poll.questCount] ?? 0) + 1;
      voterMap.set(userId, "🔀 Rimescolo");
    } else if (questIdx >= 0 && questIdx < poll.questCount) {
      voteCounts[questIdx] = (voteCounts[questIdx] ?? 0) + 1;
      voterMap.set(userId, poll.questLabels[questIdx] ?? `Missione ${questIdx + 1}`);
    }
  }

  const maxVotes = Math.max(...voteCounts, 0);
  if (maxVotes === 0) return { winners: [], maxVotes: 0, voterMap };

  const winners: number[] = [];
  for (let i = 0; i <= poll.questCount; i++) {
    if ((voteCounts[i] ?? 0) === maxVotes) {
      winners.push(i === poll.questCount ? RIMESCOLO_IDX : i);
    }
  }
  return { winners, maxVotes, voterMap };
}

async function disableSelectMenu(client: Client, channelId: string, messageId: string): Promise<void> {
  try {
    const channel = await client.channels.fetch(channelId) as TextChannel;
    const msg = await channel.messages.fetch(messageId);
    const disabledMenu = new StringSelectMenuBuilder()
      .setCustomId("vote_mission")
      .setPlaceholder("Sondaggio chiuso")
      .setDisabled(true)
      .addOptions([{ label: "Sondaggio chiuso", value: "closed" }]);
    await msg.edit({ components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(disabledMenu)] });
  } catch (err) {
    logger.warn({ err }, "Impossibile disabilitare il select menu");
  }
}

function applyTemplate(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce((str, [k, v]) => str.replaceAll(`{${k}}`, v), template);
}

function splitFieldValue(lines: string[], maxLen = EMBED_FIELD_MAX): string[] {
  const chunks: string[] = [];
  let current = "";
  for (const line of lines) {
    if (current.length + line.length + 1 > maxLen) {
      if (current) chunks.push(current);
      current = line;
    } else {
      current += (current ? "\n" : "") + line;
    }
  }
  if (current) chunks.push(current);
  return chunks.length > 0 ? chunks : ["—"];
}

async function getWinnerImageBuffer(imageUrl: string): Promise<Buffer> {
  const img = await loadImage(imageUrl);
  return img.toBuffer();
}

async function sendTempleSummaries(
  guild: Guild,
  voterMap: Map<string, string>,
  pollChannelId: string,
  resultText: string,
  winnerImageBuffer?: Buffer
): Promise<void> {
  logger.info("Avvio riepilogo templi...");

  try {
    await guild.members.fetch();
    logger.info({ memberCount: guild.members.cache.size }, "Membri fetchati");
  } catch (err) {
    logger.warn({ err }, "Impossibile fetchare i membri — riepilogo templi saltato. Verifica che l'intent GuildMembers sia abilitato nel Developer Portal.");
    return;
  }

  const config = loadConfig();
  const templeRoleNorms = new Set(
    (config.templeRoleNames ?? []).map((n) => normalize(n))
  );
  const hasTempleFilter = templeRoleNorms.size > 0;

  const channelByNorm = new Map<string, TextChannel>();
  for (const [, ch] of guild.channels.cache) {
    if (ch.isTextBased() && !ch.isThread() && ch.id !== pollChannelId) {
      channelByNorm.set(normalize(ch.name), ch as TextChannel);
    }
  }

  const roles = guild.roles.cache.filter((r) => r.name !== "@everyone");

  let matchCount = 0;
  for (const [, role] of roles) {
    const normRole = normalize(role.name);

    if (hasTempleFilter && !templeRoleNorms.has(normRole)) continue;

    const templeChannel = channelByNorm.get(normRole);
    if (!templeChannel || role.members.size === 0) continue;

    matchCount++;
    logger.info({ role: role.name, channel: templeChannel.name, members: role.members.size }, "Match trovato, invio riepilogo");

    const voted: string[] = [];
    const notVoted: string[] = [];
    for (const [memberId, member] of role.members) {
      const label = voterMap.get(memberId);
      if (label) voted.push(`${member.displayName} → ${label}`);
      else notVoted.push(member.displayName);
    }

    // Embed unico: risultato missione + riepilogo voti tempio
    const embed = new EmbedBuilder()
      .setTitle("🏁 I sondaggi sono chiusi!")
      .setDescription(
        `${resultText}\n\n` +
        `💬 **Questa è la missione che ha vinto il sondaggio — chi partecipa?**`
      )
      .setColor(EMBED_COLOR)
      .setTimestamp()
      .setFooter({ text: role.name });

    let templeAttachment: AttachmentBuilder | undefined;
    if (winnerImageBuffer) {
      templeAttachment = new AttachmentBuilder(winnerImageBuffer, { name: "winner-quest.png" });
      embed.setImage(`attachment://winner-quest.png`);
    }

    // Campo "Hanno votato"
    const votedChunks = splitFieldValue(voted.map((l) => `• ${l}`));
    embed.addFields({
      name: `✅ Hanno votato (${voted.length})`,
      value: votedChunks[0] ?? "—",
      inline: false,
    });
    for (const extra of votedChunks.slice(1)) {
      embed.addFields({ name: "\u200b", value: extra, inline: false });
    }

    // Campo "Non hanno votato" / "Tutti hanno votato"
    if (notVoted.length > 0) {
      const notVotedChunks = splitFieldValue(notVoted.map((l) => `• ${l}`));
      embed.addFields({
        name: `❌ Non hanno votato (${notVoted.length})`,
        value: notVotedChunks[0] ?? "—",
        inline: false,
      });
      for (const extra of notVotedChunks.slice(1)) {
        embed.addFields({ name: "\u200b", value: extra, inline: false });
      }
    } else {
      embed.addFields({
        name: "🎉 Tutti hanno votato!",
        value: "Ottimo lavoro al clan! 💪",
        inline: false,
      });
    }

    try {
      await templeChannel.send({
        embeds: [embed],
        ...(templeAttachment ? { files: [templeAttachment] } : {}),
      });
      logger.info({ role: role.name, channel: templeChannel.name, voted: voted.length, notVoted: notVoted.length }, "Riepilogo inviato");
    } catch (err) {
      logger.warn({ err, role: role.name, channel: templeChannel.name }, "Impossibile inviare riepilogo nel canale tempio — controlla i permessi del bot");
    }
  }

  if (matchCount === 0) {
    logger.warn("Nessun match ruolo↔canale trovato. Usa /debug-templi per diagnosticare.");
  } else {
    logger.info({ matchCount }, "Riepilogo templi completato");
  }
}

export async function closePoll(client: Client): Promise<void> {
  const config = loadConfig();
  const poll = config.activePoll;
  if (!poll) { logger.warn("closePoll chiamato ma nessun sondaggio attivo"); return; }

  logger.info({ channelId: poll.channelId, poll: JSON.stringify(poll, null, 2) }, "Chiusura sondaggio in corso...");

  const { winners, maxVotes, voterMap } = countVotes(poll);
  const messages = getMessages(config);

  if (poll.messageIds[0]) {
    await disableSelectMenu(client, poll.channelId, poll.messageIds[0]);
  }

  let resultText: string;
  let winnerImageUrl: string | undefined;
  let winnerImageBuffer: Buffer | undefined;
  const wasRimescolo = winners.length === 1 && winners[0] === RIMESCOLO_IDX;

  logger.info({ winners, wasRimescolo, questImageUrls: poll.questImageUrls }, "Dettagli vincitore");

  if (winners.length === 0) {
    resultText = messages.nessunVoto;
  } else if (wasRimescolo) {
    resultText = `🔀 **Il clan ha votato per il Rimescolo!** Ricordati di rimescolare le missioni manualmente nel gioco, poi pubblica un nuovo sondaggio.`;
  } else if (winners.length > 1) {
    const tiedLabels = winners
      .map((i) => (i === RIMESCOLO_IDX ? "🔀 Rimescolo" : (poll.questLabels[i] ?? `Missione ${i + 1}`)))
      .join(", ");
    resultText = applyTemplate(messages.pareggio, { missioni: tiedLabels });
  } else {
    const winnerIdx = winners[0]!;
    const winnerLabel = poll.questLabels[winnerIdx] ?? `Missione ${winnerIdx + 1}`;
    resultText = applyTemplate(messages.missioneVinta, { missione: winnerLabel });
    winnerImageUrl = poll.questImageUrls?.[winnerIdx];
    logger.info({ winnerIdx, winnerImageUrl }, "URL immagine vincitore");
    if (winnerImageUrl) {
      try {
        logger.info("Inizio caricamento immagine vincitore...");
        winnerImageBuffer = await getWinnerImageBuffer(winnerImageUrl);
        logger.info({ bufferSize: winnerImageBuffer.length }, "Immagine caricata con successo!");
      } catch (err) {
        logger.warn({ err }, "Impossibile caricare l'immagine della missione vincitrice");
      }
    } else {
      logger.warn("Nessun URL immagine disponibile per la missione vincitrice!");
    }
  }

  for (const [, guild] of client.guilds.cache) {
    const pollChannel = guild.channels.cache.get(poll.channelId) as TextChannel | undefined;
    if (!pollChannel) continue;

    // Embed di chiusura nel canale sondaggi (con eventuale ping ruolo)
    let roleMention = "";
    let roleId = "";
    if (config.pingRoleName) {
      const role = guild.roles.cache.find((r) => r.name === config.pingRoleName);
      if (role) { roleId = role.id; roleMention = `<@&${role.id}>`; }
    }

    const closeEmbed = new EmbedBuilder()
      .setTitle("🏁 I sondaggi sono chiusi!")
      .setDescription(resultText)
      .setColor(EMBED_COLOR)
      .setTimestamp();

    // Crea attachment per canale sondaggi e usa thumbnail (immagine piccola)
    let pollAttachment: AttachmentBuilder | undefined;
    if (winnerImageBuffer) {
      pollAttachment = new AttachmentBuilder(winnerImageBuffer, { name: "winner-quest.png" });
      closeEmbed.setThumbnail(`attachment://winner-quest.png`);
    }

    await pollChannel.send({
      content: roleMention || undefined,
      embeds: [closeEmbed],
      ...(pollAttachment ? { files: [pollAttachment] } : {}),
      allowedMentions: { roles: roleId ? [roleId] : [] },
    });

    // Notifica negli altri canali di notifica (esclusi templi — quelli ricevono l'embed unificato)
    for (const channelName of config.notifyChannelNames) {
      if (channelName === config.pollChannelName) continue;
      const notifyChannel = guild.channels.cache.find(
        (c) => c.isTextBased() && !c.isThread() && c.name === channelName
      ) as TextChannel | undefined;
      if (!notifyChannel) continue;
      const notifyEmbed = new EmbedBuilder()
        .setTitle("🏁 I sondaggi sono chiusi!")
        .setDescription(resultText)
        .setColor(EMBED_COLOR)
        .setTimestamp();
      await notifyChannel.send({ embeds: [notifyEmbed] }).catch(() => null);
    }

    // Embed unificato (risultato + riepilogo voti) nei canali tempio
    await sendTempleSummaries(guild, voterMap, poll.channelId, resultText, winnerImageBuffer);
  }

  config.activePoll = undefined;
  config.lastPollWasShuffled = wasRimescolo;
  saveConfig(config);
  logger.info({ winners, maxVotes, wasRimescolo }, "Sondaggio chiuso");
}
