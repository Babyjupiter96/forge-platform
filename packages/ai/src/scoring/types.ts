export type LeadStatus = "NEEDS_INFO" | "QUALIFIED" | "DISQUALIFIED";

export interface ScoreResult {
  score: number; // 0-100
  status: LeadStatus;
  breakdown: Record<string, number>;
}
