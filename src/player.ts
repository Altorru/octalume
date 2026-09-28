import type { CoachingReportData, ReplayPlayer } from "./types";

// Matching de pseudo, pas une preuve d'identité Steam/Epic.
export function uniquePlayerIndex(
  players: ReplayPlayer[],
  name: string,
): number | null {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return null;
  const matches = players.flatMap((player, index) =>
    !player.isBot && player.name.trim().toLowerCase() === normalized
      ? [index]
      : [],
  );
  return matches.length === 1 ? matches[0] : null;
}

export function playerTarget(players: ReplayPlayer[], index: number | null) {
  if (index === null || !Number.isInteger(index) || index < 0) return null;
  const player = players[index];
  return player && !player.isBot
    ? { index, name: player.name, team: player.team }
    : null;
}

export function reportMatchesTarget(
  report: CoachingReportData | null,
  reportPath: string,
  filePath: string,
  target: { index: number; name: string; team: number | null } | null,
): boolean {
  return Boolean(
    report &&
    target &&
    reportPath === filePath &&
    report.player.index === target.index &&
    report.player.name === target.name &&
    report.player.team === target.team,
  );
}
