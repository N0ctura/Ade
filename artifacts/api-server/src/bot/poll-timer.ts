import {
  type Client,
  type Guild,
  type TextChannel,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} from "discord.js";
import { logger } from "../lib/logger.js";
import { loadConfig, saveConfig, getMessages, type ActivePoll } from "./storage.js";

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

function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2018\u2019\u201a\u201b\u2032\u2035\u0060\u00b4]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

const RIMESCOLO_IDX = -1;

interface VoteResult {
  /** Winning quest index, or RIMESCOLO_IDX if rimescolo won */
  winners: number[];
  maxVotes: number;
  voterMap: Map<string, string>;
}

function countVotes(poll: ActivePoll): VoteResult {
  const votes = poll.votes ?? {};
  // voteCounts[0..questCount-1] = missions, voteCounts[questCount] = rimescolo
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
      // map rimescolo bucket back to RIMESCOLO_IDX
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
  } catch { /* non-fatal */ }
}

function applyTemplate(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce((str, [k, v]) => str.replaceAll(`{${k}}`, v), template);
}

async function sendTempleSummaries(
  guild: Guild,
  voterMap: Map<string, string>,
  pollChannelId: string
): Promise<void> {
  try { await guild.members.fetch(); } catch (err) {
    logger.warn({ err }, "Impossibile fetchare i membri — riepilogo templi saltato");
    return;
  }

  const channelByNorm = new Map<string, TextChannel>();
  for (const [, ch] of guild.channels.cache) {
    if (ch.isTextBased() && !ch.isThread() && ch.id !== pollChannelId) {
      channelByNorm.set(normalize(ch.name), ch as TextChannel);
    }
  }

  for (const [, role] of guild.roles.cache) {
    if (role.name === "@everyone") continue;
    const templeChannel = channelByNorm.get(normalize(role.name));
    if (!templeChannel || role.members.size === 0) continue;

    const voted: string[] = [];
    const notVoted: string[] = [];
    for (const [memberId, member] of role.members) {
      const label = voterMap.get(memberId);
      if (label) voted.push(`• ${member.displayName} → ${label}`);
      else notVoted.push(`• ${member.displayName}`);
    }

    const lines: string[] = [`📊 **Riepilogo voti — ${role.name}**\n`];
    if (voted.length > 0) { lines.push(`✅ **Hanno votato (${voted.length}):**`); lines.push(...voted); }
    else lines.push("✅ **Nessuno ha votato.**");
    lines.push("");
    if (notVoted.length > 0) { lines.push(`❌ **Non hanno votato (${notVoted.length}):**`); lines.push(...notVoted); }
    else lines.push("🎉 **Tutti hanno votato!**");

    await templeChannel.send({ content: lines.join("\n") }).catch((err) => {
      logger.warn({ err, channel: templeChannel.name }, "Impossibile inviare riepilogo nel canale tempio");
    });
    logger.info({ role: role.name, channel: templeChannel.name }, "Riepilogo voti inviato");
  }
}

export async function closePoll(client: Client): Promise<void> {
  const config = loadConfig();
  const poll = config.activePoll;
  if (!poll) { logger.warn("closePoll chiamato ma nessun sondaggio attivo"); return; }

  logger.info({ channelId: poll.channelId }, "Chiusura sondaggio in corso...");

  const { winners, maxVotes, voterMap } = countVotes(poll);
  const messages = getMessages(config);

  // Disable the select menu on the poll message
  if (poll.messageIds[0]) {
    await disableSelectMenu(client, poll.channelId, poll.messageIds[0]);
  }

  // Build result text
  let resultText: string;
  if (winners.length === 0) {
    resultText = messages.nessunVoto;
  } else if (winners.length > 1) {
    // Check if rimescolo is among winners
    const rimescoloWon = winners.includes(RIMESCOLO_IDX);
    const missionWinners = winners.filter((i) => i !== RIMESCOLO_IDX);
    if (rimescoloWon && missionWinners.length === 0) {
      resultText = `🔀 **Il clan ha votato per il Rimescolo!** Ricordati di rimescolare le missioni manualmente nel gioco, poi pubblica un nuovo sondaggio.`;
    } else {
      const tiedLabels = winners.map((i) =>
        i === RIMESCOLO_IDX ? "🔀 Rimescolo" : (poll.questLabels[i] ?? `Missione ${i + 1}`)
      ).join(", ");
      resultText = applyTemplate(messages.pareggio, { missioni: tiedLabels });
    }
  } else if (winners[0] === RIMESCOLO_IDX) {
    resultText = `🔀 **Il clan ha votato per il Rimescolo!** Ricordati di rimescolare le missioni manualmente nel gioco, poi pubblica un nuovo sondaggio.`;
  } else {
    const winnerLabel = poll.questLabels[winners[0]!] ?? `Missione ${(winners[0] ?? 0) + 1}`;
    resultText = applyTemplate(messages.missioneVinta, { missione: winnerLabel });
  }

  for (const [, guild] of client.guilds.cache) {
    const pollChannel = guild.channels.cache.get(poll.channelId) as TextChannel | undefined;
    if (!pollChannel) continue;

    let roleMention = "";
    let roleId = "";
    if (config.pingRoleName) {
      const role = guild.roles.cache.find((r) => r.name === config.pingRoleName);
      if (role) { roleId = role.id; roleMention = `<@&${role.id}> `; }
    }

    await pollChannel.send({
      content: `${roleMention}sondaggi chiusi!!\n${resultText}`,
      allowedMentions: { roles: roleId ? [roleId] : [] },
    });

    for (const channelName of config.notifyChannelNames) {
      if (channelName === config.pollChannelName) continue;
      const notifyChannel = guild.channels.cache.find(
        (c) => c.isTextBased() && !c.isThread() && c.name === channelName
      ) as TextChannel | undefined;
      if (!notifyChannel) continue;
      await notifyChannel.send({ content: `🐺 **I sondaggi sono chiusi!**\n${resultText}` }).catch(() => null);
    }

    await sendTempleSummaries(guild, voterMap, poll.channelId);
  }

  config.activePoll = undefined;
  saveConfig(config);
  logger.info({ winners, maxVotes }, "Sondaggio chiuso");
}
