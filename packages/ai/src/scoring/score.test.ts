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

  describe("threshold boundary", () => {
    // coverage 9 (3 slots) + budget 20 + timeline 20 + fit 10 = 59
    const justBelow: LeadProfile = {
      ...emptyProfile,
      budgetRange: "3k-10k",
      timeline: "immediate",
      fitServiceArea: "attract",
    };

    it("scores 59 as NEEDS_INFO", () => {
      const result = scoreLead(justBelow);
      expect(result.score).toBe(59);
      expect(result.status).toBe("NEEDS_INFO");
    });

    it("scores exactly 60 as QUALIFIED", () => {
      // coverage 15 (5 slots) + budget 10 + timeline 20 + decision maker 15 = 60
      const result = scoreLead({
        ...emptyProfile,
        businessType: "roofing",
        leadSources: ["google"],
        budgetRange: "1k-3k",
        timeline: "immediate",
        isDecisionMaker: true,
      });
      expect(result.score).toBe(60);
      expect(result.status).toBe("QUALIFIED");
    });
  });

  describe("budget", () => {
    it("scores an unanswered budget (null) lower than an answered 'unknown'", () => {
      const notAsked = scoreLead({ ...emptyProfile, budgetRange: null });
      const dontKnow = scoreLead({ ...emptyProfile, budgetRange: "unknown" });
      expect(notAsked.breakdown.budget).toBe(0);
      expect(dontKnow.breakdown.budget).toBe(5);
    });

    it.each([
      ["<1k", 0],
      ["1k-3k", 10],
      ["3k-10k", 20],
      ["10k+", 25],
    ] as const)("awards %s budget %i points", (budgetRange, points) => {
      expect(scoreLead({ ...emptyProfile, budgetRange }).breakdown.budget).toBe(points);
    });

    it("gives an unrecognised budget value zero points instead of throwing", () => {
      const result = scoreLead({ ...emptyProfile, budgetRange: "a lot" as never });
      expect(result.breakdown.budget).toBe(0);
    });
  });

  describe("timeline", () => {
    it.each([
      ["immediate", 20],
      ["1-3mo", 14],
      ["3-6mo", 8],
      ["exploring", 2],
    ] as const)("awards %s timeline %i points", (timeline, points) => {
      expect(scoreLead({ ...emptyProfile, timeline }).breakdown.timeline).toBe(points);
    });

    it("scores no timeline as zero", () => {
      expect(scoreLead(emptyProfile).breakdown.timeline).toBe(0);
    });
  });

  describe("decision maker", () => {
    it("adds 15 points when the visitor is the decision maker", () => {
      expect(scoreLead({ ...emptyProfile, isDecisionMaker: true }).breakdown.decisionMaker).toBe(15);
    });

    it("subtracts 10 when they are not, but still counts the question as answered", () => {
      const result = scoreLead({ ...emptyProfile, isDecisionMaker: false });
      expect(result.breakdown.decisionMaker).toBe(-10);
      expect(result.breakdown.coverage).toBe(3);
    });

    it("is neutral when not yet asked", () => {
      expect(scoreLead(emptyProfile).breakdown.decisionMaker).toBe(0);
    });
  });

  describe("coverage", () => {
    it("counts an empty array as unfilled", () => {
      expect(scoreLead({ ...emptyProfile, leadSources: [], currentProblems: [] }).breakdown.coverage).toBe(0);
    });

    it("counts a non-empty array as filled", () => {
      expect(scoreLead({ ...emptyProfile, leadSources: ["google"] }).breakdown.coverage).toBe(3);
    });

    it("counts an explicit false as an answer", () => {
      expect(scoreLead({ ...emptyProfile, hasWebsite: false }).breakdown.coverage).toBe(3);
    });

    it("ignores fields that aren't scoring slots", () => {
      const result = scoreLead({
        ...emptyProfile,
        servicesOffered: ["seo"],
        websiteUrl: "https://example.com",
        pipelineStage: "warm",
      });
      expect(result.breakdown.coverage).toBe(0);
    });
  });

  describe("disqualification", () => {
    it("requires both a <1k budget and a non-decision-maker", () => {
      const smallBudgetDecisionMaker = scoreLead({ ...emptyProfile, budgetRange: "<1k", isDecisionMaker: true });
      const bigBudgetNotDecisionMaker = scoreLead({ ...emptyProfile, budgetRange: "10k+", isDecisionMaker: false });
      expect(smallBudgetDecisionMaker.status).not.toBe("DISQUALIFIED");
      expect(bigBudgetNotDecisionMaker.status).not.toBe("DISQUALIFIED");
    });

    it("does not disqualify when decision-maker status is still unknown", () => {
      expect(scoreLead({ ...emptyProfile, budgetRange: "<1k", isDecisionMaker: null }).status).not.toBe("DISQUALIFIED");
    });
  });

  describe("properties", () => {
    it("is deterministic and does not mutate its input", () => {
      const profile: LeadProfile = { ...emptyProfile, businessType: "hvac", budgetRange: "3k-10k", timeline: "1-3mo" };
      const snapshot = JSON.stringify(profile);
      expect(scoreLead(profile)).toEqual(scoreLead(profile));
      expect(JSON.stringify(profile)).toBe(snapshot);
    });

    it("reports a breakdown whose parts sum to the score when it is within range", () => {
      const result = scoreLead({
        ...emptyProfile,
        businessType: "hvac",
        budgetRange: "3k-10k",
        timeline: "1-3mo",
        isDecisionMaker: true,
      });
      const sum = Object.values(result.breakdown).reduce((a, b) => a + b, 0);
      expect(result.score).toBe(sum);
    });

    it("clamps a negative raw total up to 0", () => {
      // coverage 3 + decision maker -10 = -7 raw
      const result = scoreLead({ ...emptyProfile, isDecisionMaker: false });
      expect(result.score).toBe(0);
    });
  });
});
