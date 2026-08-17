import type { Lead } from "@forge/db";
import type { LeadProfile, LeadProfileUpdate } from "@forge/shared";

export function leadToProfile(lead: Lead | null): LeadProfile {
  return {
    businessType: lead?.businessType ?? null,
    servicesOffered: lead?.servicesOffered ?? [],
    leadSources: lead?.leadSources ?? [],
    hasWebsite: lead?.hasWebsite ?? null,
    websiteUrl: lead?.websiteUrl ?? null,
    currentProblems: lead?.currentProblems ?? [],
    monthlyLeadVolume: lead?.monthlyLeadVolume ?? null,
    growthBottleneck: lead?.growthBottleneck ?? null,
    pipelineStage: lead?.pipelineStage ?? null,
    fitServiceArea: lead?.fitServiceArea ?? null,
    budgetRange: lead?.budgetRange ?? null,
    timeline: lead?.timeline ?? null,
    isDecisionMaker: lead?.isDecisionMaker ?? null,
  };
}

/** Merges one or more validated update_lead_profile tool-call payloads onto
 *  the current profile. Later calls in the same turn win on conflicts. */
export function mergeProfileUpdates(current: LeadProfile, updates: LeadProfileUpdate[]): LeadProfile {
  const merged = { ...current };
  for (const update of updates) {
    for (const [key, value] of Object.entries(update)) {
      if (value !== undefined) {
        // @ts-expect-error - key is a valid LeadProfile key by construction of LeadProfileUpdate
        merged[key] = value;
      }
    }
  }
  return merged;
}
