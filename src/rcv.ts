import type { IRVResult, IRVRound } from './types.js';

/**
 * Runs Instant Runoff Voting on a set of ballots.
 *
 * @param ballots - Each ballot is an ordered array of option labels,
 *                  from most preferred to least preferred.
 * @param options - All valid option labels in the poll.
 * @returns IRVResult with the winner (or null on exhausted tie) and per-round counts.
 */
export function runIRV(ballots: string[][], options: string[]): IRVResult {
  const rounds: IRVRound[] = [];
  const activeCandidates = new Set(options);

  // Work with copies so we don't mutate the input
  const workingBallots = ballots.map(b => [...b]);

  while (activeCandidates.size > 0) {
    // Count first-choice votes for each active candidate
    const counts = new Map<string, number>();
    for (const c of activeCandidates) counts.set(c, 0);

    let totalActive = 0;
    for (const ballot of workingBallots) {
      const top = ballot.find(c => activeCandidates.has(c));
      if (top !== undefined) {
        counts.set(top, (counts.get(top) ?? 0) + 1);
        totalActive++;
      }
    }

    const round: IRVRound = {
      counts: Object.fromEntries(counts),
      totalActive,
    };
    rounds.push(round);

    if (totalActive === 0) break; // All ballots exhausted — no winner

    // Check for majority winner (strictly more than 50%)
    for (const [candidate, count] of counts) {
      if (count / totalActive > 0.5) {
        return { winner: candidate, rounds };
      }
    }

    // No majority — eliminate the candidate(s) with the fewest first-choice votes
    const minVotes = Math.min(...counts.values());
    const toEliminate = [...counts.entries()]
      .filter(([, v]) => v === minVotes)
      .map(([k]) => k);

    for (const c of toEliminate) activeCandidates.delete(c);

    if (activeCandidates.size === 1) {
      // Last candidate standing wins
      const [lastCandidate] = activeCandidates;
      // Add a final round showing the last candidate's count
      const finalCounts = new Map<string, number>();
      let finalTotal = 0;
      for (const ballot of workingBallots) {
        const top = ballot.find(c => activeCandidates.has(c));
        if (top !== undefined) {
          finalCounts.set(top, (finalCounts.get(top) ?? 0) + 1);
          finalTotal++;
        }
      }
      rounds.push({ counts: Object.fromEntries(finalCounts), totalActive: finalTotal });
      return { winner: lastCandidate, rounds };
    }
  }

  // Tie or all candidates eliminated simultaneously
  return { winner: null, rounds };
}

/**
 * Formats IRV results into a human-readable Discord embed description.
 */
export function formatIRVResults(result: IRVResult, options: string[]): string {
  const lines: string[] = [];

  if (result.winner !== null) {
    lines.push(`## 🏆 Winner: **${result.winner}**`);
  } else {
    lines.push('## 🤝 Result: **Tie — no majority winner**');
  }

  lines.push('');
  lines.push(`**${result.rounds.length} round${result.rounds.length !== 1 ? 's' : ''}**`);

  for (let i = 0; i < result.rounds.length; i++) {
    const round = result.rounds[i];
    lines.push(`\n**Round ${i + 1}** (${round.totalActive} active ballot${round.totalActive !== 1 ? 's' : ''})`);

    // Sort candidates by vote count descending
    const sorted = options
      .filter(o => o in round.counts)
      .sort((a, b) => (round.counts[b] ?? 0) - (round.counts[a] ?? 0));

    for (const candidate of sorted) {
      const count = round.counts[candidate] ?? 0;
      const pct = round.totalActive > 0
        ? ((count / round.totalActive) * 100).toFixed(1)
        : '0.0';
      const isEliminated =
        i < result.rounds.length - 1 &&
        !(candidate in result.rounds[i + 1].counts);
      const prefix = isEliminated ? '~~' : '';
      const suffix = isEliminated ? '~~ ❌' : '';
      lines.push(`> ${prefix}**${candidate}**: ${count} vote${count !== 1 ? 's' : ''} (${pct}%)${suffix}`);
    }
  }

  return lines.join('\n');
}
