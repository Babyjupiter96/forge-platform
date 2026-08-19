import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { forOrg } from "@forge/db";
import type { LeadStatus } from "@forge/db";
import { StatusBadge } from "../../_components/StatusBadge";

const FIELD_LABELS: Record<string, string> = {
  businessType: "Business type",
  servicesOffered: "Services offered",
  leadSources: "Lead sources",
  hasWebsite: "Has a website",
  websiteUrl: "Website URL",
  currentProblems: "Current problems",
  monthlyLeadVolume: "Monthly lead volume",
  growthBottleneck: "Growth bottleneck",
  pipelineStage: "Pipeline stage",
  fitServiceArea: "Service fit",
  budgetRange: "Budget range",
  timeline: "Timeline",
  isDecisionMaker: "Decision maker",
};

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.length > 0 ? value.join(", ") : "—";
  return String(value);
}

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return null;

  const db = forOrg(session.user.orgId);
  const lead = await db.lead.findUnique({
    where: { id },
    include: { conversation: { include: { messages: { orderBy: { createdAt: "asc" } } } } },
  });

  if (!lead) notFound();

  const breakdown = (lead.scoreBreakdown as Record<string, number> | null) ?? {};

  return (
    <div className="space-y-6">
      <div>
        <Link href="/leads" className="text-sm text-muted hover:text-ink-soft">
          ← All leads
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="font-headline text-2xl text-ink">{lead.businessType ?? "Untitled lead"}</h1>
        <StatusBadge status={lead.status as LeadStatus} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-6">
          <section className="rounded-xl border border-rule bg-panel p-5">
            <h2 className="font-label text-xs uppercase tracking-[0.08em] text-muted">Score</h2>
            <p className="mt-1 font-headline text-3xl text-ink">{lead.score}</p>
            <dl className="mt-3 space-y-1 text-sm">
              {Object.entries(breakdown).map(([key, value]) => (
                <div key={key} className="flex justify-between text-ink-soft">
                  <dt className="capitalize">{key}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          {lead.bookingUrl && (
            <section className="rounded-xl border border-steel/40 bg-steel/10 p-5">
              <h2 className="font-label text-xs uppercase tracking-[0.08em] text-steel">Booking</h2>
              <a
                href={lead.bookingUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 block break-all text-sm text-steel underline"
              >
                {lead.bookingUrl}
              </a>
            </section>
          )}

          <section className="rounded-xl border border-rule bg-panel p-5">
            <h2 className="font-label text-xs uppercase tracking-[0.08em] text-muted">Qualification profile</h2>
            <dl className="mt-3 space-y-2 text-sm">
              {Object.entries(FIELD_LABELS).map(([key, label]) => (
                <div key={key} className="flex justify-between gap-4 border-t border-rule pt-2 first:border-0 first:pt-0">
                  <dt className="text-muted">{label}</dt>
                  <dd className="text-right text-ink-soft">{formatValue(lead[key as keyof typeof lead])}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>

        <section className="rounded-xl border border-rule bg-panel p-5">
          <h2 className="font-label text-xs uppercase tracking-[0.08em] text-muted">Conversation</h2>
          <div className="mt-3 flex max-h-[70vh] flex-col gap-2 overflow-y-auto pr-1">
            {lead.conversation.messages.map((m) => (
              <div
                key={m.id}
                className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                  m.role === "USER"
                    ? "self-end bg-accent text-ink"
                    : "self-start border border-rule bg-panel-alt text-ink-soft"
                }`}
              >
                {m.content || <span className="italic text-muted">(tool call only, no reply text)</span>}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
