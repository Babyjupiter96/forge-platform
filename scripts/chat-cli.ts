#!/usr/bin/env tsx
/**
 * Phase 2 acceptance harness: drives POST /api/chat so the diagnostic
 * conversation, tool-call slot filling, and scoring can be exercised and
 * watched before any widget UI exists.
 *
 * Interactive: pnpm chat-cli -- --embedKey=<key>
 * Scripted (repeatable test runs, one message per line, no readline
 * involved — reads the whole file up front and processes it in a plain
 * sequential loop): pnpm chat-cli -- --embedKey=<key> --script=path/to/turns.txt
 */
import readline from "node:readline";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { prisma } from "@forge/db";

const args = process.argv.slice(2);
const embedKey = args.find((a) => a.startsWith("--embedKey="))?.split("=")[1];
const baseUrl = args.find((a) => a.startsWith("--baseUrl="))?.split("=")[1] ?? "http://localhost:3000";
const scriptPath = args.find((a) => a.startsWith("--script="))?.split("=")[1];

if (!embedKey) {
  console.error("Usage: pnpm chat-cli -- --embedKey=<key> [--baseUrl=...] [--script=path/to/turns.txt]");
  process.exit(1);
}

const visitorId = randomUUID();
let conversationId: string | undefined;

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

async function runScript(path: string) {
  const lines = readFileSync(path, "utf-8")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    console.log(`> ${line}`);
    await handleTurn(line);
  }

  await prisma.$disconnect();
  process.exit(0);
}

function runInteractive() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log("Forge chat-cli — type a message and press enter. Ctrl+C to quit.\n");
  rl.setPrompt("> ");
  rl.prompt();

  rl.on("line", async (line) => {
    const message = line.trim();
    if (message) await handleTurn(message);
    rl.prompt();
  });

  rl.on("close", async () => {
    console.log("\n(end of input)");
    await prisma.$disconnect();
    process.exit(0);
  });
}

if (scriptPath) {
  runScript(scriptPath);
} else {
  runInteractive();
}
