import { GuildMember } from "discord.js";
import { logger } from "../lib/logger.js";

export interface WelcomeLeaveConfig {
  guildId: string;
  guildName: string;
  welcomeChannelId: string | null;
  welcomeMessage: string | null;
  welcomeEnabled: boolean;
  leaveChannelId: string | null;
  leaveMessage: string | null;
  leaveEnabled: boolean;
}

const DASHBOARD_URL = process.env.DASHBOARD_URL || "http://localhost:3000";

export async function fetchConfig(guildId: string): Promise<WelcomeLeaveConfig | null> {
  try {
    const res = await fetch(`${DASHBOARD_URL}/api/config/${guildId}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    logger.error({ err, guildId }, "Error fetching config from dashboard");
    return null;
  }
}

export function replaceVariables(message: string, member: GuildMember): string {
  return message
    .replace(/{user}/g, member.toString())
    .replace(/{username}/g, member.user.username)
    .replace(/{guild}/g, member.guild.name)
    .replace(/{memberCount}/g, member.guild.memberCount.toString());
}

export async function handleMemberJoin(member: GuildMember): Promise<void> {
  const config = await fetchConfig(member.guild.id);
  if (!config?.welcomeEnabled || !config.welcomeChannelId || !config.welcomeMessage) return;

  try {
    const channel = await member.guild.channels.fetch(config.welcomeChannelId);
    if (!channel?.isTextBased()) return;

    const message = replaceVariables(config.welcomeMessage, member);
    await channel.send(message);
    logger.info({ guildId: member.guild.id, userId: member.id }, "Welcome message sent");
  } catch (err) {
    logger.error({ err, guildId: member.guild.id }, "Error sending welcome message");
  }
}

export async function handleMemberLeave(member: GuildMember): Promise<void> {
  const config = await fetchConfig(member.guild.id);
  if (!config?.leaveEnabled || !config.leaveChannelId || !config.leaveMessage) return;

  try {
    const channel = await member.guild.channels.fetch(config.leaveChannelId);
    if (!channel?.isTextBased()) return;

    const message = replaceVariables(config.leaveMessage, member);
    await channel.send(message);
    logger.info({ guildId: member.guild.id, userId: member.id }, "Leave message sent");
  } catch (err) {
    logger.error({ err, guildId: member.guild.id }, "Error sending leave message");
  }
}

