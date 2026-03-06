import type { Poll, Vote, VotingState, CreatingState, Env } from './types.js';

// ── Poll CRUD ──────────────────────────────────────────────────────────────

export async function getPoll(env: Env, pollId: string): Promise<Poll | null> {
  return env.RCV_KV.get<Poll>(`poll:${pollId}`, 'json');
}

export async function putPoll(env: Env, poll: Poll): Promise<void> {
  await env.RCV_KV.put(`poll:${poll.id}`, JSON.stringify(poll));
}

export async function closePoll(env: Env, pollId: string): Promise<void> {
  const poll = await getPoll(env, pollId);
  if (!poll) return;
  poll.status = 'closed';
  await putPoll(env, poll);
}

// ── Vote CRUD ──────────────────────────────────────────────────────────────

export async function getVote(env: Env, pollId: string, userId: string): Promise<Vote | null> {
  return env.RCV_KV.get<Vote>(`vote:${pollId}:${userId}`, 'json');
}

export async function putVote(env: Env, pollId: string, userId: string, vote: Vote): Promise<void> {
  await env.RCV_KV.put(`vote:${pollId}:${userId}`, JSON.stringify(vote));
}

export async function getAllVotes(env: Env, pollId: string): Promise<Vote[]> {
  const { keys } = await env.RCV_KV.list({ prefix: `vote:${pollId}:` });
  const votes = await Promise.all(
    keys.map(k => env.RCV_KV.get<Vote>(k.name, 'json'))
  );
  return votes.filter((v): v is Vote => v !== null);
}

// ── In-progress voting state ───────────────────────────────────────────────

const VOTING_STATE_TTL = 30 * 60; // 30 minutes

export async function getVotingState(env: Env, pollId: string, userId: string): Promise<VotingState | null> {
  return env.RCV_KV.get<VotingState>(`voting:${pollId}:${userId}`, 'json');
}

export async function putVotingState(env: Env, pollId: string, userId: string, state: VotingState): Promise<void> {
  await env.RCV_KV.put(`voting:${pollId}:${userId}`, JSON.stringify(state), {
    expirationTtl: VOTING_STATE_TTL,
  });
}

export async function deleteVotingState(env: Env, pollId: string, userId: string): Promise<void> {
  await env.RCV_KV.delete(`voting:${pollId}:${userId}`);
}

// ── Poll creation state ────────────────────────────────────────────────────

const CREATING_STATE_TTL = 30 * 60; // 30 minutes

export async function getCreatingState(env: Env, userId: string): Promise<CreatingState | null> {
  return env.RCV_KV.get<CreatingState>(`creating:${userId}`, 'json');
}

export async function putCreatingState(env: Env, userId: string, state: CreatingState): Promise<void> {
  await env.RCV_KV.put(`creating:${userId}`, JSON.stringify(state), {
    expirationTtl: CREATING_STATE_TTL,
  });
}

export async function deleteCreatingState(env: Env, userId: string): Promise<void> {
  await env.RCV_KV.delete(`creating:${userId}`);
}

// ── ID generation ──────────────────────────────────────────────────────────

export function generatePollId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
