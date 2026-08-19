import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Forge Digital's real pipeline framework — verbatim from weforgedigitalai.com.
// Two distinct frameworks: the 5-stage revenue pipeline (the diagnostic lens)
// and the 4 service pillars (the internal fit taxonomy). Do not conflate them.
const PIPELINE = [
  { stage: "attract", label: "Attract", description: "Traffic, SEO, social, and advertising that bring the right people in." },
  { stage: "convert", label: "Convert", description: "Website, landing pages, and offers built to turn visitors into leads." },
  { stage: "follow_up", label: "Follow Up", description: "CRM, email, SMS, and AI that respond before a lead goes cold." },
  { stage: "close", label: "Close", description: "Sales process and lead management that turn interest into signed work." },
  { stage: "measure", label: "Measure", description: "Analytics and reporting that show what's working — and what to fix next." },
];

const PILLARS = [
  { area: "build", label: "Build", description: "Custom-built websites and landing pages designed to convert — brand system, copy, and build handled end to end, not a template." },
  { area: "attract", label: "Attract", description: "SEO, content, paid acquisition, and local visibility that bring the right traffic in the door." },
  { area: "automate", label: "Automate", description: "AI chat and phone agents, CRM setup, lead routing, and follow-up workflows that respond before a lead goes cold." },
  { area: "optimize", label: "Optimize", description: "Analytics and reporting that show what's working, what isn't, and what to fix next." },
];

const THEME_TOKENS = {
  bg: "#060606",
  panel: "#0E0E0E",
  panelAlt: "#131313",
  ink: "#EDEFF4",
  inkSoft: "#B7BCC8",
  muted: "#7B8394",
  accent: "#C1443A",
  steel: "#8FB3D4",
  rule: "rgba(143,179,212,0.16)",
  ruleStrong: "rgba(193,68,58,0.35)",
  fontHeadline: "'Cormorant Garamond', Georgia, serif",
  fontLabel: "'Cinzel', serif",
  fontBody: "'Jost', sans-serif",
};

const PERSONA_CONFIG = {
  orgName: "Forge Digital",
  identity:
    "You are Forge Digital's growth consultant — effectively their first SDR. You are not a generic customer-support bot. You diagnose a visitor's business bottleneck using Forge's own framework, then move qualified prospects toward booking a Free Growth Audit.",
  pipeline: PIPELINE,
  pillars: PILLARS,
  ctaLabel: "Book a Free Growth Audit",
  ctaFraming:
    "Where You Are Today → Where the Leaks Are → What It'll Take to Fix It. No pressure, just a diagnostic conversation.",
  exampleExchange: {
    visitor: "Our website looks good but we're barely getting leads.",
    assistant:
      "Got it. So the website itself isn't necessarily the problem — it's getting enough qualified people to it. Are you currently relying mostly on Google, social media, paid ads, referrals, or a mix?",
  },
  targetCustomer: "Service businesses — e.g. sales/revenue teams, healthcare & in-home care, home services, and similar.",
  guardrails: [
    "Ask one question at a time — never present the qualification fields as a checklist or form.",
    "No firm pricing quotes — only the bucketed budget ranges the visitor volunteers.",
    "Never claim to be human; never claim to be a generic AI assistant either — you represent Forge Digital specifically.",
  ],
};

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    throw new Error("SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set in .env before seeding");
  }

  const org = await prisma.organization.upsert({
    where: { slug: "forge-digital" },
    update: {},
    create: { slug: "forge-digital", name: "Forge Digital" },
  });

  const passwordHash = await bcrypt.hash(adminPassword, 12);
  const user = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash },
    create: { email: adminEmail, passwordHash },
  });

  await prisma.orgUser.upsert({
    where: { orgId_userId: { orgId: org.id, userId: user.id } },
    update: { role: "OWNER" },
    create: { orgId: org.id, userId: user.id, role: "OWNER" },
  });

  const siteData = {
    allowedOrigins: [
      "http://localhost:3000",
      "http://localhost:5173",
      "http://localhost:4501",
      "https://weforgedigitalai.com",
    ],
    themeTokens: THEME_TOKENS,
    personaConfig: PERSONA_CONFIG,
    greeting: "Hey — what's going on with your business right now?",
  };
  const existingSite = await prisma.site.findFirst({
    where: { orgId: org.id, name: "weforgedigitalai.com" },
  });
  const site = existingSite
    ? await prisma.site.update({ where: { id: existingSite.id }, data: siteData })
    : await prisma.site.create({
        data: { orgId: org.id, name: "weforgedigitalai.com", ...siteData },
      });

  const bookingConfig = {
    schedulingUrl: process.env.CALENDLY_SCHEDULING_URL ?? "https://calendly.com/forge-digital/growth-audit",
  };
  const existingBooking = await prisma.bookingIntegration.findFirst({
    where: { orgId: org.id, provider: "CALENDLY_LINK" },
  });
  if (existingBooking) {
    await prisma.bookingIntegration.update({
      where: { id: existingBooking.id },
      data: { config: bookingConfig },
    });
  } else {
    await prisma.bookingIntegration.create({
      data: { orgId: org.id, provider: "CALENDLY_LINK", config: bookingConfig },
    });
  }

  console.log("Seeded organization:", org.slug);
  console.log("Seeded site embedKey:", site.embedKey);
  console.log("Seeded owner:", user.email);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
