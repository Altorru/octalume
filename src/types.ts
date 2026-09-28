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
  player: { index: number; name: string; team: number | null };
  score: number | null;
  gameType: string;
  mistakes: string[];
  summary: string;
  strengths: string[];
  weaknesses: string[];
  advancedMetrics: { label: string; value: string; source: string }[];
  scoreRationale: string;
  confidence: "low" | "medium" | "high";
  findings: CoachingFinding[];
  dimensions: { name: string; score: number | null; rationale: string }[];
  trainingPlan: string[];
  dataQuality: GameplayQuality | null;
  isMock: boolean;
  provider: string;
  model: string;
  analysisScope: "demo" | "network-gameplay";
}

export interface GameplayQuality {
  decodedFrames: number;
  recordingSeconds: number;
  activeSeconds: number;
  targetObservedSeconds: number;
  spatialObservedSeconds: number;
  coveragePercent: number;
  completeSpatialPercent: number;
  timelineIntervalSeconds: number;
  timelineSamples: number;
  standardSoccar: boolean;
  canAssess: boolean;
  warnings: string[];
}
export interface GameplayMetric {
  key: string;
  label: string;
  value: number | null;
  unit: string;
  measuredSeconds: number;
  method: string;
}
export interface GameplayEvidence {
  id: string;
  time: number;
  endTime: number;
  kind: string;
  facts: string;
  heuristic: boolean;
}
export interface GameplayPreview {
  quality: GameplayQuality;
  metrics: GameplayMetric[];
  evidence: GameplayEvidence[];
  payloadBytes: number;
}
export interface CoachingFinding {
  evidenceId: string;
  time: number;
  endTime: number;
  facts: string;
  heuristic: boolean;
  observation: string;
  impact: string;
  correction: string;
  drill: string;
  confidence: "low" | "medium" | "high";
}
