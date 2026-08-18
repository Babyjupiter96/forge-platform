#!/usr/bin/env tsx
/**
 * Phase 2 acceptance harness: drives POST /api/chat so the diagnostic
 * conversation, tool-call slot filling, and scoring can be exercised and
 * watched before any widget UI exists. Works both interactively (type and
 * press enter) and with piped/scripted input (`cat script.txt | pnpm chat-cli
 * -- --embedKey=...`) for repeatable test runs.
 *
 * Usage: pnpm chat-cli -- --embedKey=<key> [--baseUrl=http://localhost:3000]
 */
import readline from "node:readline";
import { randomUUID } from "node:crypto";
import { prisma } from "@forge/db";

const args = process.argv.slice(2);
const embedKey = args.find((a) => a.startsWith("--embedKey="))?.split("=")[1];
const baseUrl = args.find((a) => a.startsWith("--baseUrl="))?.split("=")[1] ?? "http://localhost:3000";

if (!embedKey) {
  console.error("Usage: pnpm chat-cli -- --embedKey=<key> [--baseUrl=http://localhost:3000]");
  process.exit(1);
}

const visitorId = randomUUID();
let conversationId: string | undefined;

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

console.log("Forge chat-cli — type a message and press enter. Ctrl+C to quit.\n");

async function handleTurn(message: string) {
  try {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
      body: JSON.stringify({ embedKey, visitorId, conversationId, message }),
    });

    if (!res.ok) {
      console.error(`\n[HTTP ${res.status}] ${await res.text()}\n`);
      return;
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
}

rl.setPrompt("> ");
rl.prompt();

// Explicitly pause/resume around each turn so piped input (which arrives
// as a burst of buffered 'line' events, unlike interactive typing) is
// still processed strictly one turn at a time — each turn's request
// depends on the previous one having already been persisted.
rl.on("line", (line) => {
  rl.pause();
  const message = line.trim();
  (message ? handleTurn(message) : Promise.resolve()).finally(() => {
    rl.prompt();
    rl.resume();
  });
});

rl.on("close", async () => {
  console.log("\n(end of input)");
  await prisma.$disconnect();
  process.exit(0);
});
