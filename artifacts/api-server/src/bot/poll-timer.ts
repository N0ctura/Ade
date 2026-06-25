import {
  type Client,
  type TextChannel,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { logger } from "../lib/logger.js";
import { loadConfig, saveConfig, getMessages } from "./storage.js";
import { VOTE_EMOJIS } from "./commands/sondaggio.js";

let activeTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Schedule (or reschedule) the poll close timer.
 * Safe to call multiple times — cancels any existing timer first.
 */
export function schedulePollClose(client: Client, closesAt: string): void {
  if (activeTimer !== null) {
    clearTimeout(activeTimer);
    activeTimer = null;
  }

  const msLeft = new Date(closesAt).getTime() - Date.now();
  if (msLeft <= 0) {
    void closePoll(client);
    return;
  }

  logger.info({ closesAt, msLeft }, "Timer sondaggio programmato");
  activeTimer = setTimeout(() => {
    activeTimer = null;
    void closePoll(client);
  }, msLeft);
}

export function cancelPollTimer(): void {
  if (activeTimer !== null) {
    clearTimeout(activeTimer);
    activeTimer = null;
    logger.info("Timer sondaggio annullato");
  }
}

interface VoteResult {
  /** Indices of all winning quests (length > 1 = tie). Empty if no votes. */
  winners: number[];
  maxVotes: number;
}

/**
 * Count votes across all poll messages.
 * Returns all tied winners (or empty array if no votes).
 */
async function countVotes(
  client: Client,
  channelId: string,
  messageIds: string[],
  questCount: number
): Promise<VoteResult> {
  const voteCounts = new Array<number>(questCount).fill(0);

  for (const msgId of messageIds) {
    let msg;
    try {
      const channel = await client.channels.fetch(channelId) as TextChannel;
      msg = await channel.messages.fetch(msgId);
    } catch {
      continue;
    }

    for (const [, reaction] of msg.reactions.cache) {
      const emojiName = reaction.emoji.name;
      if (!emojiName) continue;
      const emojiIdx = VOTE_EMOJIS.indexOf(emojiName);
      if (emojiIdx === -1 || emojiIdx >= questCount) continue;

      const users = await reaction.users.fetch().catch(() => null);
      if (!users) continue;
      const humanVotes = users.filter((u) => !u.bot).size;
      voteCounts[emojiIdx] = (voteCounts[emojiIdx] ?? 0) + humanVotes;
    }
  }

  const maxVotes = Math.max(...voteCounts);
  if (maxVotes === 0) return { winners: [], maxVotes: 0 };

  const winners = voteCounts
    .map((v, i) => (v === maxVotes ? i : -1))
    .filter((i) => i !== -1);

  return { winners, maxVotes };
}

/** Disable the Rimescolo button on the LAST poll message. */
async function disableRimescoloButton(
  client: Client,
  channelId: string,
  messageIds: string[]
): Promise<void> {
  const lastMsgId = messageIds[messageIds.length - 1];
  if (!lastMsgId) return;
  try {
    const channel = await client.channels.fetch(channelId) as TextChannel;
    const msg = await channel.messages.fetch(lastMsgId);
    const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("rimescolo")
        .setLabel("🔀 Rimescolo")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true)
    );
    await msg.edit({ components: [disabledRow] });
  } catch {
    // Non-fatal — message might already be deleted
  }
}

/** Replace placeholders in a message template. */
function applyTemplate(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (str, [k, v]) => str.replaceAll(`{${k}}`, v),
    template
  );
}

export async function closePoll(client: Client): Promise<void> {
  const config = loadConfig();
  const poll = config.activePoll;

  if (!poll) {
    logger.warn("closePoll chiamato ma nessun sondaggio attivo");
    return;
  }

  logger.info({ channelId: poll.channelId }, "Chiusura sondaggio in corso...");

  const { winners, maxVotes } = await countVotes(
    client,
    poll.channelId,
    poll.messageIds,
    poll.questCount
  );

  const messages = getMessages(config);

  // Disable Rimescolo button on the last mission message
  await disableRimescoloButton(client, poll.channelId, poll.messageIds);

  // Determine result type and build closing text
  let resultText: string;
  if (winners.length === 0) {
    // No votes
    resultText = messages.nessunVoto;
  } else if (winners.length > 1) {
    // Tie
    const tiedLabels = winners
      .map((i) => poll.questLabels[i] ?? `Missione ${i + 1}`)
      .join(", ");
    resultText = applyTemplate(messages.pareggio, { missioni: tiedLabels });
  } else {
    // Single winner
    const winnerLabel = poll.questLabels[winners[0]!] ?? `Missione ${(winners[0] ?? 0) + 1}`;
    resultText = applyTemplate(messages.missioneVinta, { missione: winnerLabel });
  }

  // Find all guilds that have the poll channel
  for (const [, guild] of client.guilds.cache) {
    const pollChannel = guild.channels.cache.get(poll.channelId) as TextChannel | undefined;
    if (!pollChannel) continue;

    // Find ping role
    let roleMention = "";
    let roleId = "";
    if (config.pingRoleName) {
      const role = guild.roles.cache.find((r) => r.name === config.pingRoleName);
      if (role) {
        roleId = role.id;
        roleMention = `<@&${role.id}> `;
      }
    }

    await pollChannel.send({
      content: `${roleMention}sondaggi chiusi!!\n${resultText}`,
      allowedMentions: { roles: roleId ? [roleId] : [] },
    });

    // Notifications in other channels
    for (const channelName of config.notifyChannelNames) {
      if (channelName === config.pollChannelName) continue;
      const notifyChannel = guild.channels.cache.find(
        (c) => c.isTextBased() && !c.isThread() && c.name === channelName
      ) as TextChannel | undefined;
      if (!notifyChannel) continue;

      let notifyText: string;
      if (winners.length === 0) {
        notifyText = `🐺 **I sondaggi sono chiusi!**\n${messages.nessunVoto}`;
      } else if (winners.length > 1) {
        const tiedLabels = winners
          .map((i) => poll.questLabels[i] ?? `Missione ${i + 1}`)
          .join(", ");
        notifyText = `🐺 **I sondaggi sono chiusi!**\n${applyTemplate(messages.pareggio, { missioni: tiedLabels })}`;
      } else {
        const winnerLabel = poll.questLabels[winners[0]!] ?? `Missione ${(winners[0] ?? 0) + 1}`;
        notifyText = `🐺 **I sondaggi sono chiusi!**\n${applyTemplate(messages.missioneVinta, { missione: winnerLabel })}`;
      }

      await notifyChannel.send({ content: notifyText }).catch(() => null);
    }
  }

  config.activePoll = undefined;
  saveConfig(config);
  logger.info({ winners, maxVotes }, "Sondaggio chiuso");
}
