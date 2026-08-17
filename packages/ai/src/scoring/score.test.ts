import { describe, expect, it } from "vitest";
import type { LeadProfile } from "@forge/shared";
import { scoreLead } from "./score";

const emptyProfile: LeadProfile = {
  businessType: null,
  servicesOffered: [],
  leadSources: [],
  hasWebsite: null,
  websiteUrl: null,
  currentProblems: [],
  monthlyLeadVolume: null,
  growthBottleneck: null,
  pipelineStage: null,
  fitServiceArea: null,
  budgetRange: null,
  timeline: null,
  isDecisionMaker: null,
};

describe("scoreLead", () => {
  it("returns NEEDS_INFO with score 0 for an empty profile", () => {
    const result = scoreLead(emptyProfile);
    expect(result.score).toBe(0);
    expect(result.status).toBe("NEEDS_INFO");
  });

  it("returns QUALIFIED near 100 when all slots are filled with strong signals", () => {
    const profile: LeadProfile = {
      ...emptyProfile,
      businessType: "in-home healthcare agency",
      leadSources: ["google", "referrals"],
      hasWebsite: true,
      currentProblems: ["not enough leads"],
      monthlyLeadVolume: "10-50",
      growthBottleneck: "not enough qualified traffic",
      fitServiceArea: "attract",
      budgetRange: "10k+",
      timeline: "immediate",
      isDecisionMaker: true,
    };
    const result = scoreLead(profile);
    expect(result.status).toBe("QUALIFIED");
    expect(result.score).toBeGreaterThanOrEqual(90);
  });

  it("returns DISQUALIFIED when budget is <1k and visitor is not the decision maker, regardless of other fields", () => {
    const profile: LeadProfile = {
      ...emptyProfile,
      businessType: "landscaping",
      leadSources: ["social"],
      hasWebsite: true,
      currentProblems: ["slow follow up"],
      monthlyLeadVolume: "200+",
      growthBottleneck: "follow up",
      fitServiceArea: "automate",
      budgetRange: "<1k",
      timeline: "immediate",
      isDecisionMaker: false,
    };
    const result = scoreLead(profile);
    expect(result.status).toBe("DISQUALIFIED");
  });

  it("stays at NEEDS_INFO for a partially filled, low-signal profile", () => {
    const profile: LeadProfile = {
      ...emptyProfile,
      businessType: "consulting",
      budgetRange: "unknown",
      timeline: "exploring",
    };
    const result = scoreLead(profile);
    expect(result.status).toBe("NEEDS_INFO");
    expect(result.score).toBeLessThan(60);
  });

  it("never returns a score outside [0, 100]", () => {
    const profile: LeadProfile = {
      ...emptyProfile,
      isDecisionMaker: false,
    };
    const result = scoreLead(profile);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});
