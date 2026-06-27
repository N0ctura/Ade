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
  updatedAt: string;
}

/**
 * Fetch config from dashboard API
 */
export async function fetchConfigFromDashboard(
  guildId: string
): Promise<WelcomeLeaveConfig | null> {
  try {
    const dashboardUrl = process.env["DASHBOARD_URL"];
    if (!dashboardUrl) {
      logger.warn("DASHBOARD_URL not set");
      return null;
    }

    const response = await fetch(`${dashboardUrl}/api/config/${guildId}`);
    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (err) {
    logger.error({ err, guildId }, "Error fetching config from dashboard");
    return null;
  }
}

/**
 * Replace template variables in a message
 * Supported: {user}, {username}, {guild}, {memberCount}
 */
export function replaceTemplateVariables(
  message: string,
  member: GuildMember
): string {
  return message
    .replace(/{user}/g, member.toString()) // <@userId>
    .replace(/{username}/g, member.user.username)
    .replace(/{guild}/g, member.guild.name)
    .replace(/{memberCount}/g, member.guild.memberCount.toString());
}

/**
 * Handle member join event
 */
export async function handleMemberJoin(member: GuildMember): Promise<void> {
  const config = await fetchConfigFromDashboard(member.guild.id);

  if (
    !config ||
    !config.welcomeEnabled ||
    !config.welcomeChannelId ||
    !config.welcomeMessage
  ) {
    return;
  }

  try {
    const channel = await member.guild.channels.fetch(config.welcomeChannelId);
    if (!channel || !channel.isTextBased()) {
      logger.warn({ guildId: member.guild.id }, "Welcome channel not found or not text-based");
      return;
    }

    const message = replaceTemplateVariables(config.welcomeMessage, member);

    await channel.send(message);
    logger.info(
      {
        guildId: member.guild.id,
        userId: member.id,
        username: member.user.username,
      },
      "Welcome message sent"
    );
  } catch (err) {
    logger.error(
      { err, guildId: member.guild.id, userId: member.id },
      "Error sending welcome message"
    );
  }
}

/**
 * Handle member leave event
 */
export async function handleMemberLeave(member: GuildMember): Promise<void> {
  const config = await fetchConfigFromDashboard(member.guild.id);

  if (
    !config ||
    !config.leaveEnabled ||
    !config.leaveChannelId ||
    !config.leaveMessage
  ) {
    return;
  }

  try {
    const channel = await member.guild.channels.fetch(config.leaveChannelId);
    if (!channel || !channel.isTextBased()) {
      logger.warn({ guildId: member.guild.id }, "Leave channel not found or not text-based");
      return;
    }

    const message = replaceTemplateVariables(config.leaveMessage, member);

    await channel.send(message);
    logger.info(
      {
        guildId: member.guild.id,
        userId: member.id,
        username: member.user.username,
      },
      "Leave message sent"
    );
  } catch (err) {
    logger.error(
      { err, guildId: member.guild.id, userId: member.id },
      "Error sending leave message"
    );
  }
}

