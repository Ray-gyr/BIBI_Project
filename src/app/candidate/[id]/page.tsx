"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { ErrorBanner } from "@/components/ErrorBanner";
import { PageHeader } from "@/components/PageHeader";
import { TierBadge } from "@/components/TierBadge";
import { getCandidateDetail } from "@/lib/api";
import { useRecruitingStore } from "@/store/recruiting-store";
import type {
  CandidateComment,
  CandidateCommentRole,
  CandidateCommentType,
} from "@/types";

const roleLabels: Record<CandidateCommentRole, string> = {
  recruiter: "Recruiter",
  hiringManager: "Hiring manager",
  teamLead: "Tech lead",
};

const commentTypeStyles: Record<CandidateCommentType, string> = {
  meets: "border-emerald-200 bg-emerald-50 text-emerald-800",
  unclear: "border-amber-200 bg-amber-50 text-amber-900",
  gap: "border-rose-200 bg-rose-50 text-rose-800",
};

export default function CandidateDetailPage() {
  const params = useParams<{ id: string }>();
  const candidateId = Number.parseInt(decodeURIComponent(params.id), 10);
  const hasValidCandidateId = Number.isFinite(candidateId);
  const {
    candidates,
    criteria,
    resumeTexts,
    selectedCandidateDetail,
    candidateDetails,
    setCandidateDetail,
  } = useRecruitingStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | CandidateCommentType>("all");

  const candidate = hasValidCandidateId
    ? candidates.find((item) => item.id === candidateId)
    : undefined;
  const resumeText = hasValidCandidateId ? resumeTexts[String(candidateId)] : undefined;
  const cachedDetail =
    (hasValidCandidateId ? candidateDetails[String(candidateId)] : undefined) ??
    (selectedCandidateDetail?.candidateId === candidateId ? selectedCandidateDetail : null);

  useEffect(() => {
    let isMounted = true;

    async function loadDetail() {
      if (!hasValidCandidateId || !criteria || !resumeText || cachedDetail) {
        return;
      }

      setIsLoading(true);
      setError("");

      try {
        const detail = await getCandidateDetail({
          candidateId,
          resumeText,
          criteria,
        });

        if (isMounted) {
          setCandidateDetail(candidateId, detail);
        }
      } catch (detailError) {
        if (isMounted) {
          setError(
            detailError instanceof Error
              ? detailError.message
              : "The candidate detail service did not respond.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadDetail();

    return () => {
      isMounted = false;
    };
  }, [cachedDetail, candidateId, criteria, hasValidCandidateId, resumeText, setCandidateDetail]);

  const commentsByQuote = useMemo(() => {
    const grouped: Record<string, CandidateComment[]> = {};
    const displayQuotes: Record<string, string> = {};

    for (const comment of cachedDetail?.comments ?? []) {
      const originalQuote = comment.quote || "General Analysis";
      const normalizedQuote =
        originalQuote === "General Analysis"
          ? originalQuote
          : originalQuote.replace(/\s+/g, "").toLowerCase();

      if (!displayQuotes[normalizedQuote]) {
        displayQuotes[normalizedQuote] = originalQuote;
      }

      grouped[normalizedQuote] = [...(grouped[normalizedQuote] ?? []), comment];
    }

    const typePriority: Record<CandidateCommentType, number> = {
      gap: 0,
      unclear: 1,
      meets: 2,
    };

    // Sort within each group
    Object.keys(grouped).forEach((key) => {
      grouped[key].sort((a, b) => typePriority[a.type] - typePriority[b.type]);
    });

    // Sort groups
    const sortedGroups = Object.entries(grouped)
      .map(([normalized, comments]) => ({
        normalized,
        displayQuote: displayQuotes[normalized],
        comments,
        minPriority: Math.min(...comments.map((c) => typePriority[c.type])),
      }))
      .sort((a, b) => {
        // "General Analysis" always goes to bottom if we want, or keep it sorted by priority.
        // Let's keep it sorted by priority so critical issues always surface to top.
        return a.minPriority - b.minPriority;
      });

    return sortedGroups;
  }, [cachedDetail]);

  if (!candidate || !criteria || !resumeText) {
    return (
      <EmptyState
        title="Candidate context is unavailable"
        description="Candidate drill-downs use the ranked candidate list and cached resume text from the upload step. Return to results or rerun the analysis."
        actionHref="/results"
        actionLabel="Back to results"
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Candidate drill-down"
        title={candidate.name}
        description={candidate.summary.consensus}
        actions={
          <Link
            href="/results"
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"
          >
            Back to results
          </Link>
        }
      />

      <section className="grid gap-4 lg:grid-cols-[160px_1fr_2fr]">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-bold uppercase tracking-[0.14em] text-zinc-500">Tier</p>
          <div className="mt-3">
            <TierBadge tier={candidate.tier} />
          </div>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-bold uppercase tracking-[0.14em] text-zinc-500">Conflicts</p>
          <p className="mt-3 text-sm leading-6 text-zinc-700">
            {candidate.summary.conflicts || "No major reviewer conflicts surfaced."}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-bold uppercase tracking-[0.14em] text-zinc-500">Overview</p>
          <p className="mt-3 text-sm leading-6 text-zinc-700">
            {cachedDetail?.summary.overview ??
              "Detailed overview will appear after the candidate analysis loads."}
          </p>
        </div>
      </section>

      {isLoading ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 font-semibold text-emerald-950">
          Loading resume chunks and multi-role feedback...
        </div>
      ) : null}
      {error ? <ErrorBanner message={error} /> : null}

      {cachedDetail ? (
        <>
          <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-zinc-950">Interview questions</h2>
            <ol className="mt-3 space-y-2 text-sm leading-6 text-zinc-700 list-decimal list-inside">
              {cachedDetail.summary.interviewQuestions.map((question) => (
                <li key={question}>{question}</li>
              ))}
            </ol>
          </section>

          <section className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-zinc-950">AI Evaluation Feed</h2>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-zinc-500">Filter:</span>
                <button
                  onClick={() => setActiveFilter("all")}
                  className={`px-3 py-1 text-xs font-semibold rounded-full border transition-colors ${
                    activeFilter === "all"
                      ? "bg-zinc-800 text-white border-zinc-800"
                      : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"
                  }`}
                >
                  All
                </button>
                {(["gap", "unclear", "meets"] as CandidateCommentType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => setActiveFilter(type)}
                    className={`px-3 py-1 text-xs font-semibold rounded-full border capitalize transition-colors ${
                      activeFilter === type
                        ? commentTypeStyles[type].replace("bg-", "border-").replace("text-", "text-") // A bit hacky but works for the active state
                        : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-6">
              {commentsByQuote.map(({ displayQuote, comments }, index) => {
                const filteredComments =
                  activeFilter === "all"
                    ? comments
                    : comments.filter((c) => c.type === activeFilter);

                if (filteredComments.length === 0) return null;

                return (
                  <div
                    key={index}
                    className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
                  >
                    {displayQuote !== "General Analysis" && (
                      <div className="mb-5 rounded-lg bg-zinc-50 p-4 border-l-4 border-zinc-300">
                        <p className="text-sm italic text-zinc-600">
                          &ldquo;{displayQuote}&rdquo;
                        </p>
                      </div>
                    )}
                  <div className="space-y-4">
                    {filteredComments.map((comment, i) => (
                      <div
                        key={i}
                        className="flex flex-col sm:flex-row sm:items-start gap-4 pb-4 last:pb-0 border-b border-zinc-100 last:border-0"
                      >
                        <div className="w-40 shrink-0">
                          <p className="font-semibold text-sm text-zinc-950">
                            {roleLabels[comment.role]}
                          </p>
                          <span
                            className={[
                              "mt-1.5 inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-bold capitalize tracking-wide",
                              commentTypeStyles[comment.type],
                            ].join(" ")}
                          >
                            {comment.type}
                          </span>
                        </div>
                        <p className="text-sm leading-6 text-zinc-800 flex-1">{comment.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
