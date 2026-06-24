import {
  type Client,
  type TextChannel,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { logger } from "../lib/logger.js";
import { loadConfig, saveConfig } from "./storage.js";
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
    // Already expired — close immediately (async, fire-and-forget)
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

/**
 * Count votes across all poll messages, return the 0-based quest index with the most votes.
 * Returns -1 if no votes were cast.
 */
async function countVotes(
  client: Client,
  channelId: string,
  messageIds: string[],
  questCount: number
): Promise<number> {
  const voteCounts = new Array<number>(questCount).fill(0);

  for (let msgIdx = 0; msgIdx < messageIds.length; msgIdx++) {
    const msgId = messageIds[msgIdx]!;
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
      if (emojiIdx === -1) continue;

      // Fetch users to exclude bots
      const users = await reaction.users.fetch().catch(() => null);
      if (!users) continue;
      const humanVotes = users.filter((u) => !u.bot).size;
      if (emojiIdx < questCount) {
        voteCounts[emojiIdx] = (voteCounts[emojiIdx] ?? 0) + humanVotes;
      }
    }
  }

  let maxVotes = -1;
  let winnerIdx = -1;
  for (let i = 0; i < voteCounts.length; i++) {
    const v = voteCounts[i] ?? 0;
    if (v > maxVotes) {
      maxVotes = v;
      winnerIdx = i;
    }
  }
  return maxVotes === 0 ? -1 : winnerIdx;
}

/** Disable the Rimescolo button on the intro message */
async function disableRimescoloButton(
  client: Client,
  channelId: string,
  introMessageId: string
): Promise<void> {
  try {
    const channel = await client.channels.fetch(channelId) as TextChannel;
    const msg = await channel.messages.fetch(introMessageId);
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

export async function closePoll(client: Client): Promise<void> {
  const config = loadConfig();
  const poll = config.activePoll;

  if (!poll) {
    logger.warn("closePoll chiamato ma nessun sondaggio attivo");
    return;
  }

  logger.info({ channelId: poll.channelId }, "Chiusura sondaggio in corso...");

  // Count votes to find winner
  const winnerIdx = await countVotes(client, poll.channelId, poll.messageIds, poll.questCount);
  const winnerLabel = winnerIdx >= 0 ? (poll.questLabels[winnerIdx] ?? `Missione ${winnerIdx + 1}`) : null;

  // Disable Rimescolo button
  await disableRimescoloButton(client, poll.channelId, poll.introMessageId);

  // Find all guilds that have the poll channel
  for (const [, guild] of client.guilds.cache) {
    const pollChannel = guild.channels.cache.get(poll.channelId) as TextChannel | undefined;
    if (!pollChannel) continue;

    // Find ping role
    let roleMention = "";
    if (config.pingRoleName) {
      const role = guild.roles.cache.find((r) => r.name === config.pingRoleName);
      if (role) roleMention = `<@&${role.id}> `;
    }

    // Closing message in the poll channel
    const winnerText = winnerLabel
      ? `La missione di questa settimana è **"${winnerLabel}"** — se non lo avete già fatto potete andare a comunicare la vostra partecipazione nel tempio! 🏛️`
      : "Non ci sono voti registrati — decidete insieme al clan quale missione fare!";

    await pollChannel.send({
      content:
        `${roleMention}sondaggi chiusi!!\n` +
        winnerText,
      allowedMentions: { roles: roleMention ? [roleMention.replace(/<@&|>/g, "")] : [] },
    });

    // Notifications in other channels
    for (const channelName of config.notifyChannelNames) {
      if (channelName === config.pollChannelName) continue;
      const notifyChannel = guild.channels.cache.find(
        (c) => c.isTextBased() && !c.isThread() && c.name === channelName
      ) as TextChannel | undefined;
      if (!notifyChannel) continue;

      const notifyText = winnerLabel
        ? `🐺 **I sondaggi sono chiusi!**\nLa missione scelta è **"${winnerLabel}"**. Andate a comunicare la partecipazione nel tempio! 🏛️`
        : `🐺 **I sondaggi sono chiusi!**\nDecidete insieme al clan quale missione fare!`;

      await notifyChannel.send({ content: notifyText }).catch(() => null);
    }
  }

  // Clear the active poll
  config.activePoll = undefined;
  saveConfig(config);
  logger.info({ winner: winnerLabel }, "Sondaggio chiuso");
}
