import type { DiscordInteraction, Env, Poll } from './types.js';
import { getPoll, closePoll, getAllVotes } from './poll.js';
import { runIRV, formatIRVResults } from './rcv.js';
import { ephemeralMessage, jsonResponse, IS_COMPONENTS_V2 } from './utils.js';
import { buildPollComponents } from './commands.js';

export async function handleClosePoll(
  interaction: DiscordInteraction,
  env: Env,
  pollId: string
): Promise<Response> {
  const poll = await getPoll(env, pollId);
  if (!poll) return ephemeralMessage('Poll not found.');

  const userId = interaction.member?.user.id ?? interaction.user?.id ?? '';

  if (userId !== poll.creatorId) {
    return ephemeralMessage('Only the poll creator can close this poll.');
  }

  if (poll.status === 'closed') {
    return ephemeralMessage('This poll is already closed.');
  }

  // Mark the poll closed
  await closePoll(env, pollId);

  // Collect all submitted votes
  const votes = await getAllVotes(env, pollId);

  // Update the original poll message to show disabled buttons (fire-and-forget)
  if (interaction.message?.id && interaction.channel_id) {
    void updateOriginalMessage(env, interaction.channel_id, interaction.message.id, poll);
  }

  if (votes.length === 0) {
    return jsonResponse({
      type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
      data: {
        flags: IS_COMPONENTS_V2,
        components: [
          {
            type: 17, // Container
            accent_color: 0x747f8d, // Grey
            components: [
              {
                type: 10, // Text Display
                content: `## 🔒 Poll Closed: ${poll.question}\n\nNo votes were cast.`,
              },
            ],
          },
        ],
      },
    });
  }

  // Convert stored choice indices to option labels for the IRV algorithm
  const ballots = votes.map(v =>
    v.choices
      .map(idx => poll.options[parseInt(idx)])
      .filter((o): o is string => o !== undefined)
  );

  const result = runIRV(ballots, poll.options);
  const resultsText = formatIRVResults(result, poll.options);

  return jsonResponse({
    type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
    data: {
      flags: IS_COMPONENTS_V2,
      components: [
        {
          type: 17, // Container
          accent_color: result.winner !== null ? 0x57f287 : 0xfee75c, // Green for winner, yellow for tie
          components: [
            {
              type: 10, // Text Display
              content: `## 🔒 Poll Closed: ${poll.question}\n\n${resultsText}\n-# ${votes.length} vote${votes.length !== 1 ? 's' : ''} cast • Poll ID: ${pollId}`,
            },
          ],
        },
      ],
    },
  });
}

async function updateOriginalMessage(
  env: Env,
  channelId: string,
  messageId: string,
  poll: Poll
): Promise<void> {
  try {
    await fetch(
      `https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bot ${env.DISCORD_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          flags: IS_COMPONENTS_V2,
          components: buildPollComponents(poll, true),
        }),
      }
    );
  } catch {
    // Non-critical — ignore failures silently
  }
}
