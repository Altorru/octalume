export interface ReplayFile {
  fileName: string;
  filePath: string;
  modifiedAt: number;
  sizeBytes: number;
  gameType: string | null;
  metadata: ReplayMetadata | null;
  parseError: string | null;
}

export interface ReplayMetadata {
  replayName: string | null;
  matchDate: string | null;
  mapName: string | null;
  matchType: string | null;
  gameType: string;
  teamSize: number | null;
  recordedTeamSize: number | null;
  blueScore: number | null;
  orangeScore: number | null;
  durationSeconds: number | null;
  durationIsEstimate: boolean;
  recordedBy: string | null;
  players: ReplayPlayer[];
}

export interface ReplayPlayer {
  name: string;
  team: number | null;
  isBot: boolean;
  score: number | null;
  goals: number | null;
  assists: number | null;
  saves: number | null;
  shots: number | null;
}

export interface CoachingReportData {
  score: number;
  gameType: string;
  mistakes: string[];
  summary: string;
  strengths: string[];
  weaknesses: string[];
  advancedMetrics: { label: string; value: string }[];
  isMock: boolean;
}
