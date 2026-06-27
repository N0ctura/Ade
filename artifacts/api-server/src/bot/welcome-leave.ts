// @ts-nocheck
import { GuildMember, AttachmentBuilder } from "discord.js";
import { logger } from "../lib/logger.js";
import { loadConfig } from "./storage.js";
import { createCanvas, loadImage } from "@napi-rs/canvas";

export function replaceVariables(message: string, member: GuildMember): string {
  return message
    .replace(/{user}/g, member.toString())
    .replace(/{username}/g, member.user.username)
    .replace(/{guild}/g, member.guild.name)
    .replace(/{memberCount}/g, member.guild.memberCount.toString());
}

async function createWelcomeCard(
  member: GuildMember,
  backgroundUrl: string,
  welcomeText: string,
  subtitleText: string
): Promise<Buffer> {
  // Scarica l'immagine di sfondo
  const bgResponse = await fetch(backgroundUrl);
  const bgBuffer = Buffer.from(await bgResponse.arrayBuffer());
  const background = await loadImage(bgBuffer);

  // Crea canvas
  const canvas = createCanvas(800, 400);
  const ctx = canvas.getContext("2d");

  // Disegna sfondo
  ctx.drawImage(background, 0, 0, canvas.width, canvas.height);

  // Aggiungi overlay semi-trasparente
  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Disegna avatar
  const avatarUrl = member.user.displayAvatarURL({ extension: "png", size: 256 });
  const avatarResponse = await fetch(avatarUrl);
  const avatarBuffer = Buffer.from(await avatarResponse.arrayBuffer());
  const avatar = await loadImage(avatarBuffer);

  // Disegna cerchio per avatar
  ctx.beginPath();
  ctx.arc(canvas.width / 2, 130, 80, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  // Disegna avatar
  ctx.drawImage(avatar, canvas.width / 2 - 80, 50, 160, 160);

  // Ripristina clip
  ctx.beginPath();
  ctx.arc(canvas.width / 2, 130, 80, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  // Testo
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";

  // Titolo
  ctx.font = "bold 36px Arial";
  ctx.fillText(replaceVariables(welcomeText || `Benvenuto {username}!`, member), canvas.width / 2, 280);

  // Sottotitolo
  ctx.font = "24px Arial";
  ctx.fillText(replaceVariables(subtitleText || `Sei il {memberCount}° membro di {guild}!`, member), canvas.width / 2, 320);

  return canvas.toBuffer("image/png");
}

async function convertToBlackAndWhite(imageUrl: string): Promise<Buffer> {
  const response = await fetch(imageUrl);
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const img = await loadImage(buffer);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext("2d");

  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, img.width, img.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toBuffer("image/png");
}

export async function handleMemberJoin(member: GuildMember): Promise<void> {
  const config = loadConfig();
  const guildConfig = config.welcomeLeaveConfigs?.find(c => c.guildId === member.guild.id);
  if (!guildConfig?.welcomeEnabled || !guildConfig.welcomeChannelId) return;

  try {
    const channel = await member.guild.channels.fetch(guildConfig.welcomeChannelId);
    if (!channel?.isTextBased()) return;

    const messageContent = guildConfig.welcomeMessage ? replaceVariables(guildConfig.welcomeMessage, member) : "";

    let files = [];
    if (guildConfig.welcomeImageUrl) {
      try {
        const cardBuffer = await createWelcomeCard(
          member,
          guildConfig.welcomeImageUrl,
          guildConfig.welcomeCardTitle,
          guildConfig.welcomeCardSubtitle
        );
        const attachment = new AttachmentBuilder(cardBuffer, { name: "welcome-card.png" });
        files.push(attachment);
      } catch (err) {
        logger.error({ err, guildId: member.guild.id }, "Error creating welcome card");
      }
    }

    const messagePayload: any = {};
    if (messageContent) messagePayload.content = messageContent;
    if (files.length > 0) messagePayload.files = files;

    if (Object.keys(messagePayload).length > 0) {
      await channel.send(messagePayload);
      logger.info({ guildId: member.guild.id, userId: member.id }, "Welcome message sent");
    }
  } catch (err) {
    logger.error({ err, guildId: member.guild.id }, "Error sending welcome message");
  }
}

export async function handleMemberLeave(member: GuildMember): Promise<void> {
  const config = loadConfig();
  const guildConfig = config.welcomeLeaveConfigs?.find(c => c.guildId === member.guild.id);
  if (!guildConfig?.leaveEnabled || !guildConfig.leaveChannelId) return;

  try {
    const channel = await member.guild.channels.fetch(guildConfig.leaveChannelId);
    if (!channel?.isTextBased()) return;

    const messageContent = guildConfig.leaveMessage ? replaceVariables(guildConfig.leaveMessage, member) : "";

    let files = [];
    if (guildConfig.welcomeImageUrl && guildConfig.leaveImageEnabled) {
      try {
        const bwBuffer = await convertToBlackAndWhite(guildConfig.welcomeImageUrl);
        const attachment = new AttachmentBuilder(bwBuffer, { name: "leave.png" });
        files.push(attachment);
      } catch (err) {
        logger.error({ err, guildId: member.guild.id }, "Error converting image to black and white");
      }
    }

    const messagePayload: any = {};
    if (messageContent) messagePayload.content = messageContent;
    if (files.length > 0) messagePayload.files = files;

    if (Object.keys(messagePayload).length > 0) {
      await channel.send(messagePayload);
      logger.info({ guildId: member.guild.id, userId: member.id }, "Leave message sent");
    }
  } catch (err) {
    logger.error({ err, guildId: member.guild.id }, "Error sending leave message");
  }
}

