import type { LeadProfile } from "@forge/shared";
import type { ScoreResult } from "./types";

// Tunable constants. These are initial values based on the qualification
// spec, not final — expect to adjust the QUALIFIED threshold and weight
// distribution after seeing real conversations (see Phase 2 plan notes).
const COVERAGE_SLOTS: (keyof LeadProfile)[] = [
  "businessType",
  "leadSources",
  "hasWebsite",
  "currentProblems",
  "monthlyLeadVolume",
  "growthBottleneck",
  "fitServiceArea",
  "budgetRange",
  "timeline",
  "isDecisionMaker",
];
const POINTS_PER_FILLED_SLOT = 3; // max 30 pts across 10 slots

const BUDGET_POINTS: Record<string, number> = {
  "<1k": 0,
  "1k-3k": 10,
  "3k-10k": 20,
  "10k+": 25,
  unknown: 5,
};

const TIMELINE_POINTS: Record<string, number> = {
  immediate: 20,
  "1-3mo": 14,
  "3-6mo": 8,
  exploring: 2,
};

const DECISION_MAKER_POINTS = 15;
const NON_DECISION_MAKER_PENALTY = -10;
const FIT_POINTS = 10;

const QUALIFIED_THRESHOLD = 60;

function isFilled(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/**
 * Pure, deterministic, auditable scoring — zero AI calls. This is the
 * actual gate for whether a booking link is offered; the model's own
 * conversational sense of "they seem ready" is only ever a hint (see
 * forge-persona.ts), never the decision.
 */
export function scoreLead(profile: LeadProfile): ScoreResult {
  const breakdown: Record<string, number> = {};

  breakdown.coverage =
    COVERAGE_SLOTS.filter((slot) => isFilled(profile[slot])).length * POINTS_PER_FILLED_SLOT;

  // profile.budgetRange === null means "not asked yet" and must score 0,
  // distinct from the "unknown" bucket (visitor was asked, said they
  // don't know) which intentionally gets a small non-zero signal.
  breakdown.budget = profile.budgetRange ? (BUDGET_POINTS[profile.budgetRange] ?? 0) : 0;
  breakdown.timeline = TIMELINE_POINTS[profile.timeline ?? ""] ?? 0;

  breakdown.decisionMaker =
    profile.isDecisionMaker === true
      ? DECISION_MAKER_POINTS
      : profile.isDecisionMaker === false
        ? NON_DECISION_MAKER_PENALTY
        : 0;

  breakdown.fit = profile.fitServiceArea ? FIT_POINTS : 0;

  const rawScore = Object.values(breakdown).reduce((sum, v) => sum + v, 0);
  const score = Math.max(0, Math.min(100, rawScore));

  const disqualified = profile.budgetRange === "<1k" && profile.isDecisionMaker === false;

  const status = disqualified ? "DISQUALIFIED" : score >= QUALIFIED_THRESHOLD ? "QUALIFIED" : "NEEDS_INFO";

  return { score, status, breakdown };
}
