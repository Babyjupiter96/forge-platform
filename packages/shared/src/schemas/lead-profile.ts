import { z } from "zod";

/**
 * The qualification slots the AI incrementally fills via the
 * `update_lead_profile` tool call. All fields optional — the model only
 * sends what it's confident about, each turn. This schema is the single
 * source of truth for both the OpenAI tool definition (packages/ai) and
 * server-side validation before writing to the `Lead` row.
 */
export const LeadSourceEnum = z.enum(["google", "social", "paid_ads", "referrals", "other"]);
export const MonthlyLeadVolumeEnum = z.enum(["0-10", "10-50", "50-200", "200+"]);
export const PipelineStageEnum = z.enum(["attract", "convert", "follow_up", "close", "measure"]);
export const FitServiceAreaEnum = z.enum(["build", "attract", "automate", "optimize"]);
export const BudgetRangeEnum = z.enum(["<1k", "1k-3k", "3k-10k", "10k+", "unknown"]);
export const TimelineEnum = z.enum(["immediate", "1-3mo", "3-6mo", "exploring"]);

export const LeadProfileUpdateSchema = z.object({
  businessType: z.string().min(1).max(200).optional(),
  servicesOffered: z.array(z.string().min(1).max(100)).max(20).optional(),
  leadSources: z.array(LeadSourceEnum).max(5).optional(),
  hasWebsite: z.boolean().optional(),
  websiteUrl: z.string().max(300).optional(),
  currentProblems: z.array(z.string().min(1).max(200)).max(20).optional(),
  monthlyLeadVolume: MonthlyLeadVolumeEnum.optional(),
  growthBottleneck: z.string().min(1).max(300).optional(),
  pipelineStage: PipelineStageEnum.optional(),
  fitServiceArea: FitServiceAreaEnum.optional(),
  budgetRange: BudgetRangeEnum.optional(),
  timeline: TimelineEnum.optional(),
  isDecisionMaker: z.boolean().optional(),
});

export type LeadProfileUpdate = z.infer<typeof LeadProfileUpdateSchema>;

/**
 * The full profile as persisted/read from the `Lead` row (all slots
 * present, possibly null/empty). Used as scorer input.
 */
export interface LeadProfile {
  businessType: string | null;
  servicesOffered: string[];
  leadSources: string[];
  hasWebsite: boolean | null;
  websiteUrl: string | null;
  currentProblems: string[];
  monthlyLeadVolume: string | null;
  growthBottleneck: string | null;
  pipelineStage: string | null;
  fitServiceArea: string | null;
  budgetRange: string | null;
  timeline: string | null;
  isDecisionMaker: boolean | null;
}
