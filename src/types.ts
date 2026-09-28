export interface ReplayFile {
  fileName: string;
  filePath: string;
  modifiedAt: number;
  sizeBytes: number;
  gameType: string | null;
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
