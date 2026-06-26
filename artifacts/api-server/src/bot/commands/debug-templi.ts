import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
} from "discord.js";
import { normalize } from "../normalize.js";
import { loadConfig, saveConfig } from "../storage.js";

export const data = new SlashCommandBuilder()
  .setName("debug-templi")
  .setDescription("Mostra il match ruoli↔canali e aggiorna l'archivio ruoli (solo admin)")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

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

  // ── Aggiorna archivio ruoli nella config ─────────────────────────────────
  // Classifica ogni ruolo in base al match con un canale:
  //   templeRoleNames    → ha un canale corrispondente (ruoli tempio)
  //   thresholdRoleNames → nessun canale, 0 membri  (soglie XP, ecc.)
  //   leaderRoleNames    → nessun canale, ha membri  (co-capi, admin, ecc.)
  const templeRoleNames: string[] = [];
  const thresholdRoleNames: string[] = [];
  const leaderRoleNames: string[] = [];

  for (const [, role] of roles) {
    const normRole = normalize(role.name);
    if (channelByNorm.has(normRole)) {
      templeRoleNames.push(role.name);
    } else if (role.members.size === 0) {
      thresholdRoleNames.push(role.name);
    } else {
      leaderRoleNames.push(role.name);
    }
  }

  const config = loadConfig();
  config.templeRoleNames = templeRoleNames;
  config.thresholdRoleNames = thresholdRoleNames;
  config.leaderRoleNames = leaderRoleNames;
  saveConfig(config);

  // ── Costruzione risposta ──────────────────────────────────────────────────
  const lines: string[] = [
    `**🔍 Debug riepilogo templi**`,
    `Canali testo trovati: **${channelByNorm.size}**`,
    `Ruoli totali: **${roles.size}** (escluso @everyone)`,
    ``,
    `**🏛️ Ruoli-Tempio (hanno canale corrispondente):**`,
  ];

  let matchCount = 0;
  for (const [, role] of roles) {
    const normRole = normalize(role.name);
    const matchedChannel = channelByNorm.get(normRole);
    const memberCount = role.members.size;
    if (matchedChannel) {
      lines.push(`✅ \`${role.name}\`  →  #${matchedChannel}  (${memberCount} membri)`);
      matchCount++;
    }
  }
  if (matchCount === 0) lines.push("❌ Nessun match trovato.");

  lines.push(``, `**📊 Ruoli senza canale (co-capi / admin):**`);
  if (leaderRoleNames.length > 0) {
    for (const n of leaderRoleNames) lines.push(`• \`${n}\``);
  } else {
    lines.push("Nessuno.");
  }

  lines.push(``, `**⭐ Ruoli soglia XP (nessun membro attivo):**`);
  if (thresholdRoleNames.length > 0) {
    for (const n of thresholdRoleNames) lines.push(`• \`${n}\``);
  } else {
    lines.push("Nessuno.");
  }

  lines.push(
    ``,
    `**Totale match ruolo↔canale: ${matchCount}**`,
    ``,
    `✅ Archivio ruoli aggiornato nella config.`
  );

  if (matchCount === 0) {
    lines.push(
      ``,
      `⚠️ **Nessun match trovato.** Assicurati che il nome del ruolo (dopo normalizzazione) corrisponda al nome del canale.`,
      `Esempio: ruolo \`♢🔱𝐓𝐞𝐦𝐩𝐢𝐨-𝐝𝐞𝐠𝐥𝐢-𝐀𝐛𝐢𝐬𝐬𝐢\` → canale \`#tempio-degli-abissi\` (entrambi diventano \`tempioabissi\` dopo normalizzazione)`
    );
  }

  const text = lines.join("\n");
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
