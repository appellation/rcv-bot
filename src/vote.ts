import type { DiscordInteraction, Env, SelectOption, VotingState } from './types.js';
import { getPoll, getVotingState, putVotingState, putVote, deleteVotingState } from './poll.js';
import { ephemeralMessage, updateMessage, ordinal } from './utils.js';

// ── Helper: build the voting ephemeral message ─────────────────────────────

function buildVoteMessage(
  pollId: string,
  question: string,
  allOptions: string[],
  chosenIndices: string[],
  step: number
): { content: string; components: unknown[] } {
  const remainingOptions: SelectOption[] = allOptions
    .map((label, i) => ({ label, value: String(i) }))
    .filter(o => !chosenIndices.includes(o.value));

  const progressLines = chosenIndices.map((idx, rank) => {
    const label = allOptions[parseInt(idx)];
    return `${ordinal(rank)} choice: **${label}**`;
  });

  const progress = progressLines.length > 0
    ? progressLines.join('\n') + '\n\n'
    : '';

  const content = `**Voting: ${question}**\n\n${progress}Select your **${ordinal(step)} choice**:`;

  const components: unknown[] = [
    {
      type: 1, // Action Row
      components: [
        {
          type: 3, // String Select
          custom_id: `rank:${pollId}:${step}`,
          placeholder: `Your ${ordinal(step)} choice…`,
          options: remainingOptions,
          min_values: 1,
          max_values: 1,
        },
      ],
    },
    {
      type: 1, // Action Row
      components: [
        {
          type: 2, // Button
          custom_id: `done:${pollId}`,
          label: chosenIndices.length === 0 ? 'Skip all' : 'Submit vote now',
          style: chosenIndices.length === 0 ? 2 : 3, // Secondary or Success (green)
        },
      ],
    },
  ];

  return { content, components };
}

function formatChoices(choices: string[], options: string[]): string {
  return choices
    .map((idx, rank) => `${ordinal(rank)} choice: **${options[parseInt(idx)]}**`)
    .join(', ');
}

// ── Handlers ───────────────────────────────────────────────────────────────

export async function handleVoteButton(
  interaction: DiscordInteraction,
  env: Env,
  pollId: string
): Promise<Response> {
  const poll = await getPoll(env, pollId);
  if (!poll) return ephemeralMessage('Poll not found.');
  if (poll.status === 'closed') return ephemeralMessage('This poll is already closed.');

  const userId = interaction.member?.user.id ?? interaction.user?.id ?? '';

  // Reset any in-progress vote state and start fresh (allows re-voting)
  const initialState: VotingState = { choices: [], step: 0 };
  await putVotingState(env, pollId, userId, initialState);

  const { content, components } = buildVoteMessage(pollId, poll.question, poll.options, [], 0);

  return new Response(
    JSON.stringify({
      type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
      data: { content, components, flags: 64 }, // 64 = EPHEMERAL
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}

export async function handleRankSelect(
  interaction: DiscordInteraction,
  env: Env,
  pollId: string,
  step: number
): Promise<Response> {
  const poll = await getPoll(env, pollId);
  if (!poll) return ephemeralMessage('Poll not found.');
  if (poll.status === 'closed') return ephemeralMessage('This poll is already closed.');

  const userId = interaction.member?.user.id ?? interaction.user?.id ?? '';
  const selectedValue = interaction.data?.values?.[0];
  if (selectedValue === undefined) return ephemeralMessage('No selection received.');

  const state = await getVotingState(env, pollId, userId) ?? { choices: [], step: 0 };

  // Guard against replayed or out-of-sync interactions
  if (state.step !== step) {
    return updateMessage({
      content: 'Your voting session expired or became out of sync. Please click **🗳️ Vote** again.',
      components: [],
    });
  }

  state.choices.push(selectedValue);
  state.step++;

  // When only one option remains unranked, auto-append it as last and submit
  if (state.step >= poll.options.length - 1) {
    const allIndices = poll.options.map((_, i) => String(i));
    const remaining = allIndices.find(i => !state.choices.includes(i));
    if (remaining !== undefined) state.choices.push(remaining);

    await putVote(env, pollId, userId, { choices: state.choices });
    await deleteVotingState(env, pollId, userId);

    const summary = formatChoices(state.choices, poll.options);
    return updateMessage({
      content: `✅ **Vote submitted!**\n${summary}`,
      components: [],
    });
  }

  // Save progress and show the next select menu
  await putVotingState(env, pollId, userId, state);

  const { content, components } = buildVoteMessage(
    pollId,
    poll.question,
    poll.options,
    state.choices,
    state.step
  );

  return updateMessage({ content, components });
}

export async function handleDoneButton(
  interaction: DiscordInteraction,
  env: Env,
  pollId: string
): Promise<Response> {
  const poll = await getPoll(env, pollId);
  if (!poll) return ephemeralMessage('Poll not found.');

  const userId = interaction.member?.user.id ?? interaction.user?.id ?? '';
  const state = await getVotingState(env, pollId, userId);

  if (!state || state.choices.length === 0) {
    return updateMessage({
      content: 'Please select at least one choice before submitting.',
      components: [],
    });
  }

  await putVote(env, pollId, userId, { choices: state.choices });
  await deleteVotingState(env, pollId, userId);

  const summary = formatChoices(state.choices, poll.options);
  return updateMessage({
    content: `✅ **Vote submitted!** (partial ranking — unranked options are not counted)\n${summary}`,
    components: [],
  });
}
