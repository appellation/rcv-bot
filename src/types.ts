export interface Poll {
  id: string;
  question: string;
  options: string[];
  creatorId: string;
  guildId: string;
  channelId: string;
  status: 'open' | 'closed';
  createdAt: number;
}

export interface Vote {
  // Option indices as strings, ordered from most to least preferred
  choices: string[];
}

export interface Env {
  RCV_KV: KVNamespace;
  DISCORD_PUBLIC_KEY: string;
  DISCORD_APPLICATION_ID: string;
  DISCORD_TOKEN: string;
}

// Discord interaction types
export interface DiscordInteraction {
  id: string;
  application_id: string;
  type: number;
  token: string;
  guild_id?: string;
  channel_id?: string;
  member?: {
    user: DiscordUser;
    permissions: string;
  };
  user?: DiscordUser;
  data?: InteractionData;
  message?: DiscordMessage;
}

export interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  global_name?: string;
}

export interface DiscordMessage {
  id: string;
  channel_id: string;
  embeds: DiscordEmbed[];
}

export interface InteractionData {
  id?: string;
  name?: string;
  options?: CommandOption[];
  custom_id?: string;
  component_type?: number;
  values?: string[];
  components?: DiscordComponent[];
}

export interface CommandOption {
  name: string;
  type: number;
  value?: string | number | boolean;
  options?: CommandOption[];
}

export interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  footer?: { text: string };
}

export interface DiscordComponent {
  type: number;
  custom_id?: string;
  label?: string;
  style?: number;
  placeholder?: string;
  min_values?: number;
  max_values?: number;
  value?: string;      // text input value in modal submissions
  values?: string[];   // select menu selected values in modal submissions
  options?: SelectOption[];
  components?: DiscordComponent[]; // Action Row children
  component?: DiscordComponent;    // Label child (singular)
}

export interface CreatingState {
  question: string;
  options: string[];
}

export interface SelectOption {
  label: string;
  value: string;
  description?: string;
}

export interface IRVRound {
  counts: Record<string, number>;
  totalActive: number;
}

export interface IRVResult {
  winner: string | null;
  rounds: IRVRound[];
}
