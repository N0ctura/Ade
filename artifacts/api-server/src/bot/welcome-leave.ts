// @ts-nocheck
import { GuildMember } from "discord.js";
import { logger } from "../lib/logger.js";
import { loadConfig } from "./storage.js";

export function replaceVariables(message: string, member: GuildMember): string {
  return message
    .replace(/{user}/g, member.toString())
    .replace(/{username}/g, member.user.username)
    .replace(/{guild}/g, member.guild.name)
    .replace(/{memberCount}/g, member.guild.memberCount.toString());
}

export async function handleMemberJoin(member: GuildMember): Promise<void> {
  const config = loadConfig();
  const guildConfig = config.welcomeLeaveConfigs?.find(c => c.guildId === member.guild.id);
  if (!guildConfig?.welcomeEnabled || !guildConfig.welcomeChannelId || !guildConfig.welcomeMessage) return;

  try {
    const channel = await member.guild.channels.fetch(guildConfig.welcomeChannelId);
    if (!channel?.isTextBased()) return;

    const message = replaceVariables(guildConfig.welcomeMessage, member);
    await channel.send(message);
    logger.info({ guildId: member.guild.id, userId: member.id }, "Welcome message sent");
  } catch (err) {
    logger.error({ err, guildId: member.guild.id }, "Error sending welcome message");
  }
}

export async function handleMemberLeave(member: GuildMember): Promise<void> {
  const config = loadConfig();
  const guildConfig = config.welcomeLeaveConfigs?.find(c => c.guildId === member.guild.id);
  if (!guildConfig?.leaveEnabled || !guildConfig.leaveChannelId || !guildConfig.leaveMessage) return;

  try {
    const channel = await member.guild.channels.fetch(guildConfig.leaveChannelId);
    if (!channel?.isTextBased()) return;

    const message = replaceVariables(guildConfig.leaveMessage, member);
    await channel.send(message);
    logger.info({ guildId: member.guild.id, userId: member.id }, "Leave message sent");
  } catch (err) {
    logger.error({ err, guildId: member.guild.id }, "Error sending leave message");
  }
}

