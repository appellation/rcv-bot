import type { DiscordInteraction, Env } from './types.js';
import { verifyDiscordRequest } from './verify.js';
import { handleCreatePoll } from './commands.js';
import { handlePollAddButton, handlePollModalSubmit, handlePollFinalize } from './create.js';
import { handleVoteButton, handleRankSelect, handleDoneButton } from './vote.js';
import { handleClosePoll } from './close.js';
import { jsonResponse } from './utils.js';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Only POST is valid for Discord interactions
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const body = await request.text();

    // Verify the request came from Discord
    const isValid = verifyDiscordRequest(request, body, env.DISCORD_PUBLIC_KEY);
    if (!isValid) {
      return new Response('Invalid request signature', { status: 401 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let parsed: any;
    try {
      parsed = JSON.parse(body);
    } catch (e) {
      console.error('Failed to parse body:', String(e));
      return new Response('Invalid JSON body', { status: 400 });
    }

    // Discord's newer Event Webhook format wraps interactions in a string-typed envelope:
    //   { type: "PING" }                                          → acknowledge
    //   { type: "INTERACTION_CREATE", data: { <interaction> } }  → unwrap and route
    // The classic Interactions Endpoint format uses numeric types (1, 2, 3, 5).
    if (typeof parsed.type === 'string') {
      if (parsed.type === 'PING') {
        return new Response(null, { status: 204 });
      }
      if (parsed.type === 'INTERACTION_CREATE' && parsed.data) {
        parsed = parsed.data;
      } else {
        return new Response(null, { status: 204 });
      }
    }

    const interaction = parsed as DiscordInteraction;

    // Type 1: PING — Discord sends this to verify the endpoint
    if (interaction.type === 1) {
      return jsonResponse({ type: 1 }); // PONG
    }

    // Type 2: APPLICATION_COMMAND (slash commands)
    if (interaction.type === 2) {
      if (interaction.data?.name === 'createpoll') {
        return handleCreatePoll(interaction, env);
      }
      return new Response('Unknown command', { status: 400 });
    }

    // Type 3: MESSAGE_COMPONENT (buttons, select menus)
    if (interaction.type === 3) {
      const customId = interaction.data?.custom_id ?? '';
      const parts = customId.split(':');
      const action = parts[0];
      const id = parts[1];       // pollId or userId depending on action
      const stepStr = parts[2];

      if (!id) return new Response('Malformed custom_id', { status: 400 });

      // Poll creation flow
      if (action === 'poll_add') return handlePollAddButton(interaction, env, id);
      if (action === 'poll_finalize') return handlePollFinalize(interaction, env, id, ctx);

      // Voting flow
      if (action === 'vote') return handleVoteButton(interaction, env, id);
      if (action === 'rank') return handleRankSelect(interaction, env, id, parseInt(stepStr ?? '0', 10));
      if (action === 'done') return handleDoneButton(interaction, env, id);
      if (action === 'close') return handleClosePoll(interaction, env, id);

      // Disabled button stubs — acknowledge silently
      if (action === 'vote_disabled' || action === 'close_disabled') {
        return jsonResponse({
          type: 4,
          data: { content: 'This poll is closed.', flags: 64 },
        });
      }

      return new Response('Unknown component', { status: 400 });
    }

    // Type 5: MODAL_SUBMIT
    if (interaction.type === 5) {
      const customId = interaction.data?.custom_id ?? '';
      const colonIdx = customId.indexOf(':');
      const action = colonIdx === -1 ? customId : customId.slice(0, colonIdx);
      const userId = colonIdx === -1 ? '' : customId.slice(colonIdx + 1);

      if (action === 'poll_add_modal') return handlePollModalSubmit(interaction, env, userId);

      return new Response('Unknown modal', { status: 400 });
    }

    console.error('Unhandled interaction type:', interaction.type);
    return new Response('Unhandled interaction type', { status: 400 });
  },
};
