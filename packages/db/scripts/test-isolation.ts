/**
 * Phase 1 acceptance check: explicit proof that forOrg() actually isolates
 * tenants, not just code-review confidence. Seeds a throwaway second org,
 * asserts org A's scoped client cannot see org B's data (and vice versa),
 * then cleans up.
 */
import { prisma } from "../src/client";
import { forOrg } from "../src/scoped";

async function main() {
  const orgA = await prisma.organization.findUnique({ where: { slug: "forge-digital" } });
  if (!orgA) {
    throw new Error("Seed forge-digital first: pnpm db:seed");
  }

  const orgB = await prisma.organization.create({
    data: { slug: `isolation-test-${Date.now()}`, name: "Isolation Test Org" },
  });

  const siteB = await prisma.site.create({
    data: {
      orgId: orgB.id,
      name: "isolation-test.example.com",
      allowedOrigins: ["http://localhost:9999"],
      themeTokens: {},
      personaConfig: {},
    },
  });

  const conversationB = await prisma.conversation.create({
    data: { orgId: orgB.id, siteId: siteB.id, visitorId: "isolation-test-visitor" },
  });

  const leadB = await prisma.lead.create({
    data: { orgId: orgB.id, conversationId: conversationB.id, businessType: "SHOULD_NOT_BE_VISIBLE_TO_ORG_A" },
  });

  const dbA = forOrg(orgA.id);
  const dbB = forOrg(orgB.id);

  const leaksFromA = await dbA.lead.findMany({ where: { id: leadB.id } });
  const visibleFromB = await dbB.lead.findMany({ where: { id: leadB.id } });

  await prisma.organization.delete({ where: { id: orgB.id } }); // cascades site/conversation/lead

  let failed = false;

  if (leaksFromA.length !== 0) {
    console.error("FAIL: org A's scoped client could see org B's lead — isolation is broken.");
    failed = true;
  } else {
    console.log("PASS: org A's scoped client cannot see org B's lead.");
  }

  if (visibleFromB.length !== 1) {
    console.error("FAIL: org B's own scoped client could not see its own lead.");
    failed = true;
  } else {
    console.log("PASS: org B's scoped client can see its own lead.");
  }

  await prisma.$disconnect();
  process.exit(failed ? 1 : 0);
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
