import Link from "next/link";
import { auth } from "@/auth";
import { forOrg } from "@forge/db";
import type { LeadStatus } from "@forge/db";
import { StatusBadge } from "../_components/StatusBadge";

export default async function LeadsPage() {
  const session = await auth();
  if (!session?.user) return null;

  const db = forOrg(session.user.orgId);
  const leads = await db.lead.findMany({
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  return (
    <div className="space-y-5">
      <h1 className="font-headline text-2xl text-ink">Leads ({leads.length})</h1>

      {leads.length === 0 ? (
        <p className="text-sm text-muted">
          No leads yet. Run <code className="rounded bg-panel-alt px-1 py-0.5">pnpm chat-cli</code> to test a
          conversation.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-rule">
          <table className="w-full text-left text-sm">
            <thead className="bg-panel-alt font-label text-[11px] uppercase tracking-[0.06em] text-muted">
              <tr>
                <th className="px-4 py-3">Business</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3">Bottleneck</th>
                <th className="px-4 py-3">Budget</th>
                <th className="px-4 py-3">Booking</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className="border-t border-rule bg-panel hover:bg-panel-alt">
                  <td className="px-4 py-3">
                    <Link href={`/leads/${lead.id}`} className="text-ink hover:text-steel">
                      {lead.businessType ?? "Untitled lead"}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={lead.status as LeadStatus} />
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{lead.score}</td>
                  <td className="max-w-xs truncate px-4 py-3 text-ink-soft">{lead.growthBottleneck ?? "—"}</td>
                  <td className="px-4 py-3 text-ink-soft">{lead.budgetRange ?? "—"}</td>
                  <td className="px-4 py-3">
                    {lead.bookingUrl ? (
                      <a href={lead.bookingUrl} className="text-steel underline" target="_blank" rel="noreferrer">
                        link
                      </a>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
