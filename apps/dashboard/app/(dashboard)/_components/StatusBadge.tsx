import type { LeadStatus } from "@forge/db";

const STYLES: Record<LeadStatus, string> = {
  QUALIFIED: "bg-steel/15 text-steel border-steel/40",
  NEEDS_INFO: "bg-ink-soft/10 text-ink-soft border-rule",
  DISQUALIFIED: "bg-accent/10 text-accent border-accent/40",
  BOOKED: "bg-steel/25 text-steel border-steel/60",
};

export function StatusBadge({ status }: { status: LeadStatus }) {
  return (
    <span
      className={`inline-block rounded-full border px-2.5 py-0.5 font-label text-[11px] uppercase tracking-[0.06em] ${STYLES[status]}`}
    >
      {status.replace("_", " ")}
    </span>
  );
}
