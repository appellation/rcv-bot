import type { DiscordInteraction, Env, Poll } from './types.js';
import {
  getCreatingState,
  putCreatingState,
  deleteCreatingState,
  putPoll,
  generatePollId,
} from './poll.js';
import { ephemeralMessage, jsonResponse, IS_COMPONENTS_V2 } from './utils.js';
import { buildCreationUI, buildPollComponents } from './commands.js';

const MAX_OPTIONS = 20;

// ── "➕ Add Option" button ─────────────────────────────────────────────────

export async function handlePollAddButton(
  _interaction: DiscordInteraction,
  env: Env,
  userId: string
): Promise<Response> {
  const state = await getCreatingState(env, userId);
  if (!state) {
    return ephemeralMessage('Your poll creation session expired. Start over with `/createpoll`.');
  }
  if (state.options.length >= MAX_OPTIONS) {
    return ephemeralMessage(`Maximum of ${MAX_OPTIONS} options reached.`);
  }

  // Open a modal for the user to type a new option
  return jsonResponse({
    type: 9, // MODAL
    data: {
      custom_id: `poll_add_modal:${userId}`,
      title: 'Add Poll Option',
      components: [
        {
          type: 1, // Action Row
          components: [
            {
              type: 4, // Text Input
              custom_id: 'poll_option_text',
              label: 'Option text',
              style: 1, // SHORT
              min_length: 1,
              max_length: 100,
              required: true,
              placeholder: 'e.g., Ranked Choice Voting',
            },
          ],
        },
      ],
    },
  });
}

// ── Modal submission ───────────────────────────────────────────────────────

export async function handlePollModalSubmit(
  interaction: DiscordInteraction,
  env: Env,
  userId: string
): Promise<Response> {
  // Extract the text the user typed from the modal's component tree
  const optionText = interaction.data?.components
    ?.flatMap(row => row.components ?? [])
    .find(c => c.custom_id === 'poll_option_text')
    ?.value;

  if (!optionText?.trim()) {
    return ephemeralMessage('Option text cannot be empty.');
  }

  const state = await getCreatingState(env, userId);
  if (!state) {
    return ephemeralMessage('Your poll creation session expired. Start over with `/createpoll`.');
  }
  if (state.options.length >= MAX_OPTIONS) {
    return ephemeralMessage(`Maximum of ${MAX_OPTIONS} options reached.`);
  }

  state.options.push(optionText.trim());
  await putCreatingState(env, userId, state);

  // UPDATE_MESSAGE (type 7) is valid here because the modal was triggered
  // from a message component (the "Add Option" button).
  return jsonResponse({
    type: 7, // UPDATE_MESSAGE
    data: {
      flags: IS_COMPONENTS_V2 | 64, // keep ephemeral
      components: buildCreationUI(userId, state),
    },
  });
}

// ── "✅ Create Poll" button ────────────────────────────────────────────────

export async function handlePollFinalize(
  interaction: DiscordInteraction,
  env: Env,
  userId: string,
  ctx: ExecutionContext
): Promise<Response> {
  const state = await getCreatingState(env, userId);
  if (!state) {
    return ephemeralMessage('Your poll creation session expired. Start over with `/createpoll`.');
  }
  if (state.options.length < 2) {
    return ephemeralMessage('Please add at least 2 options before creating the poll.');
  }

  const pollId = generatePollId();
  const creatorId = interaction.member?.user.id ?? interaction.user?.id ?? 'unknown';

  const poll: Poll = {
    id: pollId,
    question: state.question,
    options: state.options,
    creatorId,
    guildId: interaction.guild_id ?? 'dm',
    channelId: interaction.channel_id ?? '',
    status: 'open',
    createdAt: Date.now(),
  };

  await Promise.all([putPoll(env, poll), deleteCreatingState(env, userId)]);

  // Post the public poll as a non-ephemeral follow-up via the interaction webhook.
  // waitUntil lets this run after we've already sent the response to Discord.
  ctx.waitUntil(
    fetch(
      `https://discord.com/api/v10/webhooks/${env.DISCORD_APPLICATION_ID}/${interaction.token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flags: IS_COMPONENTS_V2,
          components: buildPollComponents(poll, false),
        }),
      }
    ).catch(e => console.error('Failed to post poll follow-up:', String(e)))
  );

  // Update the ephemeral creation interface to a success state
  return jsonResponse({
    type: 7, // UPDATE_MESSAGE
    data: {
      flags: IS_COMPONENTS_V2 | 64,
      components: [
        {
          type: 17, // Container
          accent_color: 0x57f287, // Green
          components: [
            {
              type: 10, // Text Display
              content: `## ✅ Poll Created\n**${state.question}** has been posted in the channel with ${state.options.length} options.`,
            },
          ],
        },
      ],
    },
  });
}
