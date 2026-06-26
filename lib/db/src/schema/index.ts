import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";

/**
 * Configurazione del bot Discord.
 * Una sola riga con key = 'main'.
 * Usata come storage durevole invece del filesystem (che è efimero su Railway).
 */
export const botConfigTable = pgTable("bot_config", {
  key: text("key").primaryKey(),
  data: jsonb("data").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
