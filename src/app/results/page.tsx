"use client";

import Link from "next/link";
import { CandidateTable } from "@/components/CandidateTable";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { TierBadge } from "@/components/TierBadge";
import { useRecruitingStore } from "@/store/recruiting-store";
import type { CandidateTier } from "@/types";

const tiers: CandidateTier[] = ["Strong Hire", "Hire", "Maybe", "No"];

export default function ResultsPage() {
  const { candidates } = useRecruitingStore();
  const followUpRiskCount = candidates.filter(
    (candidate) =>
      candidate.tier === "Maybe" ||
      candidate.tier === "No" ||
      !candidate.summary.conflicts.toLowerCase().includes("no major"),
  ).length;

  if (candidates.length === 0) {
    return (
      <EmptyState
        title="No ranked candidates yet"
        description="Upload resumes and run the AI evaluation to generate the ranked candidate table."
        actionHref="/upload-resumes"
        actionLabel="Upload resumes"
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Step 4"
        title="Ranked candidate results"
        description="Review the AI-ranked slate, then open a candidate profile for resume chunks and multi-role feedback."
        actions={
          <Link
            href="/upload-resumes"
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"
          >
            Add resumes
          </Link>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiers.map((tier) => (
          <div key={tier} className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <TierBadge tier={tier} />
            <p className="mt-3 text-3xl font-semibold text-zinc-950">
              {candidates.filter((candidate) => candidate.tier === tier).length}
            </p>
            <p className="mt-1 text-sm text-zinc-600">Candidates</p>
          </div>
        ))}
      </section>



      {followUpRiskCount > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
          <span className="font-semibold">Review checkpoint:</span> Some candidates have
          conflicts, weak fit, or incomplete evidence. Validate those notes before outreach or
          rejection.
        </div>
      ) : null}

      <CandidateTable candidates={candidates} />
    </div>
  );
}
