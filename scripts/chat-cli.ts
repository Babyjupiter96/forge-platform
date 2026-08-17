#!/usr/bin/env tsx
/**
 * Phase 2 acceptance harness: drives POST /api/chat from the terminal so
 * the diagnostic conversation, tool-call slot filling, and scoring can be
 * exercised and watched before any widget UI exists.
 *
 * Usage: pnpm chat-cli --embedKey=<key> [--baseUrl=http://localhost:3000]
 */
import readline from "node:readline";
import { randomUUID } from "node:crypto";
import { prisma } from "@forge/db";

const args = process.argv.slice(2);
const embedKey = args.find((a) => a.startsWith("--embedKey="))?.split("=")[1];
const baseUrl = args.find((a) => a.startsWith("--baseUrl="))?.split("=")[1] ?? "http://localhost:3000";

if (!embedKey) {
  console.error("Usage: pnpm chat-cli --embedKey=<key> [--baseUrl=http://localhost:3000]");
  process.exit(1);
}

const visitorId = randomUUID();
let conversationId: string | undefined;

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

console.log("Forge chat-cli — type a message and press enter. Ctrl+C to quit.\n");

function prompt() {
  rl.question("> ", async (message) => {
    if (!message.trim()) return prompt();

    try {
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
        body: JSON.stringify({ embedKey, visitorId, conversationId, message }),
      });

      if (!res.ok) {
        console.error(`\n[HTTP ${res.status}] ${await res.text()}\n`);
        return prompt();
      }

      const data = await res.json();
      conversationId = data.conversationId;

      console.log(`\nAssistant: ${data.reply}\n`);
      console.log(
        `[score=${data.lead.score} status=${data.lead.status}` +
          (data.lead.bookingUrl ? ` bookingUrl=${data.lead.bookingUrl}` : "") +
          `]`,
      );

      const lead = await prisma.lead.findUnique({ where: { conversationId } });
      if (lead) {
        console.log(
          "[lead profile]",
          JSON.stringify(
            {
              businessType: lead.businessType,
              servicesOffered: lead.servicesOffered,
              leadSources: lead.leadSources,
              hasWebsite: lead.hasWebsite,
              currentProblems: lead.currentProblems,
              monthlyLeadVolume: lead.monthlyLeadVolume,
              growthBottleneck: lead.growthBottleneck,
              pipelineStage: lead.pipelineStage,
              fitServiceArea: lead.fitServiceArea,
              budgetRange: lead.budgetRange,
              timeline: lead.timeline,
              isDecisionMaker: lead.isDecisionMaker,
              scoreBreakdown: lead.scoreBreakdown,
            },
            null,
            2,
          ),
        );
      }
      console.log();
    } catch (err) {
      console.error("Request failed:", err);
    }

    prompt();
  });
}

prompt();
