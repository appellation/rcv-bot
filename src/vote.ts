import type { DiscordInteraction, Env } from './types.js';
import { getPoll, putVote } from './poll.js';
import { ephemeralMessage, jsonResponse, ordinal } from './utils.js';

// ── Handlers ───────────────────────────────────────────────────────────────

export async function handleVoteButton(
  _interaction: DiscordInteraction,
  env: Env,
  pollId: string
): Promise<Response> {
  const poll = await getPoll(env, pollId);
  if (!poll) return ephemeralMessage('Poll not found.');
  if (poll.status === 'closed') return ephemeralMessage('This poll is already closed.');

  const numSlots = Math.min(poll.options.length, 5);
  const selectOptions = poll.options.map((label, i) => ({ label, value: String(i) }));

  const components = Array.from({ length: numSlots }, (_, i) => ({
    type: 18, // Label
    label: `${ordinal(i)} choice${i === 0 ? '' : ' (optional)'}`,
    component: {
      type: 3, // String Select
      custom_id: `choice:${i}`,
      placeholder: 'Select an option…',
      options: selectOptions,
      min_values: i === 0 ? 1 : 0,
      max_values: 1,
      required: i === 0,
    },
  }));

  const title = poll.question.length <= 45
    ? poll.question
    : poll.question.slice(0, 44) + '…';

  const payload = {
    type: 9, // MODAL
    data: {
      custom_id: `vote_modal:${pollId}`,
      title,
      components,
    },
  };

  return jsonResponse(payload);
}

export async function handleVoteModalSubmit(
  interaction: DiscordInteraction,
  env: Env,
  pollId: string
): Promise<Response> {
  const poll = await getPoll(env, pollId);
  if (!poll) return ephemeralMessage('Poll not found.');
  if (poll.status === 'closed') return ephemeralMessage('This poll is already closed.');

  const userId = interaction.member?.user.id ?? interaction.user?.id ?? '';

  // Label components use singular `component`, Action Rows use `components` array
  const inputs = (interaction.data?.components ?? [])
    .map(row => row.component ?? row.components?.[0])
    .filter((c): c is NonNullable<typeof c> => c != null);

  const numSlots = Math.min(poll.options.length, 5);
  const chosenIndices: string[] = [];
  const seenIndices = new Set<string>();

  for (let i = 0; i < numSlots; i++) {
    const selected = inputs.find(c => c.custom_id === `choice:${i}`)?.values?.[0];
    if (selected === undefined) continue; // optional slot left blank

    if (seenIndices.has(selected)) {
      return ephemeralMessage(
        `You selected **${poll.options[parseInt(selected)]}** for multiple ranks. Each option can only appear once.`
      );
    }
    seenIndices.add(selected);
    chosenIndices.push(selected); // already 0-based index strings
  }

  if (chosenIndices.length === 0) {
    return ephemeralMessage('Please select at least one choice.');
  }

  // Auto-append the single remaining option if only one is left unranked
  if (chosenIndices.length === poll.options.length - 1) {
    const allIndices = poll.options.map((_, i) => String(i));
    const remaining = allIndices.find(i => !chosenIndices.includes(i));
    if (remaining !== undefined) chosenIndices.push(remaining);
  }

  await putVote(env, pollId, userId, { choices: chosenIndices });

  const summary = chosenIndices
    .map((idx, rank) => `${ordinal(rank)} choice: **${poll.options[parseInt(idx)]}**`)
    .join('\n');

  return ephemeralMessage(`✅ **Vote submitted!**\n${summary}`);
}
