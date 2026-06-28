/**
 * Shared Type Definitions for Ade Bot Control Panel
 */

export interface GitHubFile {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  download_url: string | null;
  type: "file" | "dir";
}

export interface CardLayer {
  id: string;
  type: "background" | "avatar" | "text" | "image";
  visible: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  url?: string;
  text?: string;
  fontSize?: number;
  fontWeight?: "normal" | "bold";
  color?: string;
  textAlign?: "left" | "center" | "right";
  borderRadius?: number;
  borderWidth?: number;
  borderColor?: string;
}

export interface CardConfig {
  width: number;
  height: number;
  layers: CardLayer[];
}

export interface ModuleConfig {
  welcome: {
    enabled: boolean;
    channelId: string;
    message: string;
    card: CardConfig;
  };
  leave: {
    enabled: boolean;
    channelId: string;
    message: string;
    card: CardConfig;
  };
  autoRole: {
    enabled: boolean;
    roleIds: string[];
    roles: Array<{ id: string; name: string; color: string }>;
  };
  tts: {
    enabled: boolean;
    sourceChannelId: string;
    voiceChannelId: string;
    language: string;
    prefixes: string[];
  };
  scheduledMessages: Array<{
    id: string;
    channelId: string;
    message: string;
    isRecurring: boolean;
    recurrenceInterval: string;
    enabled: boolean;
  }>;
  logsConfig: {
    enabled: boolean;
    channelId: string;
    interceptApps: boolean;
    interceptUsers: boolean;
  };
}

export interface DeletedModifiedLog {
  id: string;
  timestamp: string;
  type: "deleted" | "modified";
  author: {
    username: string;
    avatar: string;
    isBot: boolean;
  };
  channel: string;
  oldContent?: string;
  newContent?: string;
  deletedContent?: string;
}

export interface LogEntry {
  timestamp: string;
  type: string;
  message: string;
}

export interface BotStatus {
  online: boolean;
  platform: string;
  uptime: string;
  guildsCount: number;
  membersCount: number;
  ping: string;
  logs: LogEntry[];
  repoUrl: string;
}
