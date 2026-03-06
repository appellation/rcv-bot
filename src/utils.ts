// Set on messages that use the newer component-only layout (no content/embeds)
export const IS_COMPONENTS_V2 = 1 << 15; // 32768

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function ephemeralMessage(content: string): Response {
  return jsonResponse({
    type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
    data: {
      content,
      flags: 64, // EPHEMERAL
    },
  });
}

export function updateMessage(data: {
  content?: string;
  embeds?: unknown[];
  components?: unknown[];
}): Response {
  return jsonResponse({
    type: 7, // UPDATE_MESSAGE
    data: { ...data, flags: 64 },
  });
}

const ORDINALS = ['1st', '2nd', '3rd', '4th', '5th'];
export function ordinal(n: number): string {
  return ORDINALS[n] ?? `${n + 1}th`;
}
