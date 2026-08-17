import { auth } from "@/auth";
import { forOrg } from "@forge/db";

export default async function LeadsPage() {
  const session = await auth();
  if (!session?.user) return null;

  const db = forOrg(session.user.orgId);
  const leads = await db.lead.findMany({
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Leads ({leads.length})</h1>

      {leads.length === 0 ? (
        <p className="text-sm text-neutral-400">
          No leads yet. Run <code className="rounded bg-neutral-800 px-1">pnpm chat-cli</code> to test a
          conversation.
        </p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="text-neutral-400">
            <tr>
              <th className="py-2 pr-4">Business</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Score</th>
              <th className="py-2 pr-4">Bottleneck</th>
              <th className="py-2 pr-4">Budget</th>
              <th className="py-2 pr-4">Booking</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.id} className="border-t border-neutral-800">
                <td className="py-2 pr-4">{lead.businessType ?? "—"}</td>
                <td className="py-2 pr-4">{lead.status}</td>
                <td className="py-2 pr-4">{lead.score}</td>
                <td className="py-2 pr-4">{lead.growthBottleneck ?? "—"}</td>
                <td className="py-2 pr-4">{lead.budgetRange ?? "—"}</td>
                <td className="py-2 pr-4">
                  {lead.bookingUrl ? (
                    <a href={lead.bookingUrl} className="text-blue-400 underline" target="_blank" rel="noreferrer">
                      link
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
