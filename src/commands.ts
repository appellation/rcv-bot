import type { DiscordInteraction, Env, Poll, CreatingState } from './types.js';
import { putCreatingState } from './poll.js';
import { ephemeralMessage, jsonResponse, IS_COMPONENTS_V2 } from './utils.js';

const MAX_OPTIONS = 20;

export async function handleCreatePoll(interaction: DiscordInteraction, env: Env): Promise<Response> {
  const options = interaction.data?.options ?? [];
  const question = options.find(o => o.name === 'question')?.value;
  if (!question || typeof question !== 'string' || !question.trim()) {
    return ephemeralMessage('Please provide a question.');
  }

  const userId = interaction.member?.user.id ?? interaction.user?.id ?? 'unknown';
  const state: CreatingState = { question: question.trim(), options: [] };
  await putCreatingState(env, userId, state);

  return jsonResponse({
    type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
    data: {
      flags: IS_COMPONENTS_V2 | 64, // ephemeral
      components: buildCreationUI(userId, state),
    },
  });
}

export function buildCreationUI(userId: string, state: CreatingState): unknown[] {
  const atMax = state.options.length >= MAX_OPTIONS;
  const canFinalize = state.options.length >= 2;
  const optionsList = state.options.length === 0
    ? '*No options yet — add at least 2.*'
    : state.options.map((o, i) => `**${i + 1}.** ${o}`).join('\n');

  return [
    {
      type: 17, // Container
      accent_color: 0x5865f2, // Blurple
      components: [
        {
          type: 10, // Text Display
          content: `## 🗳️ Creating Poll\n**${state.question}**\n\n${optionsList}${atMax ? `\n\n*Maximum of ${MAX_OPTIONS} options reached.*` : ''}`,
        },
        { type: 14 }, // Separator
        {
          type: 1, // Action Row
          components: [
            {
              type: 2, // Button
              custom_id: `poll_add:${userId}`,
              label: '➕ Add Option',
              style: 2, // Secondary
              disabled: atMax,
            },
            {
              type: 2, // Button
              custom_id: `poll_finalize:${userId}`,
              label: '✅ Create Poll',
              style: canFinalize ? 3 : 2, // Success green when ready
              disabled: !canFinalize,
            },
          ],
        },
      ],
    },
  ];
}

// Shared helper used by close.ts and create.ts for the public poll message
export function buildPollComponents(poll: Poll, closed: boolean): unknown[] {
  const optionsList = poll.options.map((o, i) => `**${i + 1}.** ${o}`).join('\n');
  const status = closed ? 'Closed' : 'Open';

  return [
    {
      type: 17, // Container
      accent_color: closed ? 0x747f8d : 0x5865f2,
      components: [
        {
          type: 10, // Text Display
          content: `## 📊 ${poll.question}\n\n${optionsList}\n-# Poll ID: ${poll.id} • Status: ${status} • ${poll.options.length} options`,
        },
        { type: 14 }, // Separator
        {
          type: 1, // Action Row
          components: [
            {
              type: 2, // Button
              custom_id: closed ? 'vote_disabled' : `vote:${poll.id}`,
              label: '🗳️ Vote',
              style: closed ? 2 : 1,
              disabled: closed,
            },
            {
              type: 2, // Button
              custom_id: closed ? 'close_disabled' : `close:${poll.id}`,
              label: closed ? '🔒 Poll Closed' : '🔒 Close Poll',
              style: 4,
              disabled: closed,
            },
          ],
        },
      ],
    },
  ];
}
