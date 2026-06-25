import {
  type Client,
  type Guild,
  type TextChannel,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { logger } from '../lib/logger.js';
import { loadConfig, saveConfig, getMessages } from './storage.js';
import { VOTE_EMOJIS } from './commands/sondaggio.js';

let activeTimer: ReturnType<typeof setTimeout> | null = null;

export function schedulePollClose(client: Client, closesAt: string): void {
  if (activeTimer !== null) { clearTimeout(activeTimer); activeTimer = null; }
  const msLeft = new Date(closesAt).getTime() - Date.now();
  if (msLeft <= 0) { void closePoll(client); return; }
  logger.info({ closesAt, msLeft }, 'Timer sondaggio programmato');
  activeTimer = setTimeout(() => { activeTimer = null; void closePoll(client); }, msLeft);
}

export function cancelPollTimer(): void {
  if (activeTimer !== null) { clearTimeout(activeTimer); activeTimer = null; logger.info('Timer sondaggio annullato'); }
}

function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[‘’‚‛′‵`´]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

interface VoteResult {
  winners: number[];
  maxVotes: number;
  voterMap: Map<string, string>;
}

async function countVotes(
  client: Client,
  channelId: string,
  messageIds: string[],
  questCount: number,
  questLabels: string[]
): Promise<VoteResult> {
  const voteCounts = new Array<number>(questCount).fill(0);
  const voterMap = new Map<string, string>();

  for (const msgId of messageIds) {
    let msg;
    try {
      const channel = await client.channels.fetch(channelId) as TextChannel;
      msg = await channel.messages.fetch(msgId);
    } catch { continue; }

    for (const [, reaction] of msg.reactions.cache) {
      const emojiName = reaction.emoji.name;
      if (!emojiName) continue;
      const emojiIdx = VOTE_EMOJIS.indexOf(emojiName);
      if (emojiIdx === -1 || emojiIdx >= questCount) continue;
      const users = await reaction.users.fetch().catch(() => null);
      if (!users) continue;
      for (const [userId, user] of users) {
        if (user.bot) continue;
        voteCounts[emojiIdx] = (voteCounts[emojiIdx] ?? 0) + 1;
        voterMap.set(userId, questLabels[emojiIdx] ?? ('Missione ' + (emojiIdx + 1)));
      }
    }
  }

  const maxVotes = Math.max(...voteCounts);
  if (maxVotes === 0) return { winners: [], maxVotes: 0, voterMap };
  const winners = voteCounts.map((v, i) => (v === maxVotes ? i : -1)).filter((i) => i !== -1);
  return { winners, maxVotes, voterMap };
}

/** Disable the Rimescolo button on the INTRO message (where it lives) */
async function disableRimescoloButton(client: Client, channelId: string, introMessageId: string): Promise<void> {
  try {
    const channel = await client.channels.fetch(channelId) as TextChannel;
    const msg = await channel.messages.fetch(introMessageId);
    const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('rimescolo').setLabel('🔀 Rimescolo').setStyle(ButtonStyle.Secondary).setDisabled(true)
    );
    await msg.edit({ components: [disabledRow] });
  } catch { /* non-fatal */ }
}

function applyTemplate(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce((str, [k, v]) => str.replaceAll('{' + k + '}', v), template);
}

async function sendTempleSummaries(
  guild: Guild,
  voterMap: Map<string, string>,
  pollChannelId: string
): Promise<void> {
  try { await guild.members.fetch(); } catch (err) {
    logger.warn({ err }, 'Impossibile fetchare i membri — riepilogo templi saltato');
    return;
  }

  const channelByNorm = new Map<string, TextChannel>();
  for (const [, ch] of guild.channels.cache) {
    if (ch.isTextBased() && !ch.isThread() && ch.id !== pollChannelId) {
      channelByNorm.set(normalize(ch.name), ch as TextChannel);
    }
  }

  for (const [, role] of guild.roles.cache) {
    if (role.name === '@everyone') continue;
    const normRole = normalize(role.name);
    const templeChannel = channelByNorm.get(normRole);
    if (!templeChannel) continue;

    const members = role.members;
    if (members.size === 0) continue;

    const voted: string[] = [];
    const notVoted: string[] = [];

    for (const [memberId, member] of members) {
      const displayName = member.displayName;
      const questLabel = voterMap.get(memberId);
      if (questLabel) {
        voted.push('• ' + displayName + ' → ' + questLabel);
      } else {
        notVoted.push('• ' + displayName);
      }
    }

    const lines: string[] = ['📊 **Riepilogo voti — ' + role.name + '**
'];
    if (voted.length > 0) {
      lines.push('✅ **Hanno votato (' + voted.length + '):**');
      lines.push(...voted);
    } else {
      lines.push('✅ **Nessuno ha votato.**');
    }
    lines.push('');
    if (notVoted.length > 0) {
      lines.push('❌ **Non hanno votato (' + notVoted.length + '):**');
      lines.push(...notVoted);
    } else {
      lines.push('🎉 **Tutti hanno votato!**');
    }

    await templeChannel.send({ content: lines.join('
') }).catch((err) => {
      logger.warn({ err, channel: templeChannel.name }, 'Impossibile inviare riepilogo nel canale tempio');
    });
    logger.info({ role: role.name, channel: templeChannel.name, voted: voted.length, notVoted: notVoted.length }, 'Riepilogo voti inviato');
  }
}

export async function closePoll(client: Client): Promise<void> {
  const config = loadConfig();
  const poll = config.activePoll;
  if (!poll) { logger.warn('closePoll chiamato ma nessun sondaggio attivo'); return; }

  logger.info({ channelId: poll.channelId }, 'Chiusura sondaggio in corso...');

  const { winners, maxVotes, voterMap } = await countVotes(
    client, poll.channelId, poll.messageIds, poll.questCount, poll.questLabels
  );
  const messages = getMessages(config);

  // Disable button on the INTRO message (that's where Rimescolo lives)
  await disableRimescoloButton(client, poll.channelId, poll.introMessageId);

  let resultText: string;
  if (winners.length === 0) {
    resultText = messages.nessunVoto;
  } else if (winners.length > 1) {
    const tiedLabels = winners.map((i) => poll.questLabels[i] ?? ('Missione ' + (i + 1))).join(', ');
    resultText = applyTemplate(messages.pareggio, { missioni: tiedLabels });
  } else {
    const winnerLabel = poll.questLabels[winners[0]!] ?? ('Missione ' + ((winners[0] ?? 0) + 1));
    resultText = applyTemplate(messages.missioneVinta, { missione: winnerLabel });
  }

  for (const [, guild] of client.guilds.cache) {
    const pollChannel = guild.channels.cache.get(poll.channelId) as TextChannel | undefined;
    if (!pollChannel) continue;

    let roleMention = '';
    let roleId = '';
    if (config.pingRoleName) {
      const role = guild.roles.cache.find((r) => r.name === config.pingRoleName);
      if (role) { roleId = role.id; roleMention = '<@&' + role.id + '> '; }
    }

    await pollChannel.send({
      content: roleMention + 'sondaggi chiusi!!
' + resultText,
      allowedMentions: { roles: roleId ? [roleId] : [] },
    });

    for (const channelName of config.notifyChannelNames) {
      if (channelName === config.pollChannelName) continue;
      const notifyChannel = guild.channels.cache.find(
        (c) => c.isTextBased() && !c.isThread() && c.name === channelName
      ) as TextChannel | undefined;
      if (!notifyChannel) continue;

      let notifyText: string;
      if (winners.length === 0) {
        notifyText = '🐺 **I sondaggi sono chiusi!**
' + messages.nessunVoto;
      } else if (winners.length > 1) {
        const tiedLabels = winners.map((i) => poll.questLabels[i] ?? ('Missione ' + (i + 1))).join(', ');
        notifyText = '🐺 **I sondaggi sono chiusi!**
' + applyTemplate(messages.pareggio, { missioni: tiedLabels });
      } else {
        const winnerLabel = poll.questLabels[winners[0]!] ?? ('Missione ' + ((winners[0] ?? 0) + 1));
        notifyText = '🐺 **I sondaggi sono chiusi!**
' + applyTemplate(messages.missioneVinta, { missione: winnerLabel });
      }
      await notifyChannel.send({ content: notifyText }).catch(() => null);
    }

    await sendTempleSummaries(guild, voterMap, poll.channelId);
  }

  config.activePoll = undefined;
  saveConfig(config);
  logger.info({ winners, maxVotes }, 'Sondaggio chiuso');
}
