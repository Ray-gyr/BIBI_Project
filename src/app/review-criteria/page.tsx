"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CriteriaEditor } from "@/components/CriteriaEditor";
import { EmptyState } from "@/components/EmptyState";
import { ErrorBanner } from "@/components/ErrorBanner";
import { PageHeader } from "@/components/PageHeader";
import { refineJobDescription } from "@/lib/api";
import { useRecruitingStore } from "@/store/recruiting-store";
import type { Criteria, UserComment } from "@/types";

const emptyCriteria: Criteria = {
  mustHave: [],
  nice2Have: [],
  redFlags: [],
};

export default function ReviewCriteriaPage() {
  const router = useRouter();
  const {
    rawJD,
    criteria,
    refinedJD,
    idealCandidateProfile,
    updateCriteria,
    setJobRefinement,
  } = useRecruitingStore();
  const [draft, setDraft] = useState<Criteria>(criteria ?? emptyCriteria);
  const [error, setError] = useState("");

  const [comments, setComments] = useState<UserComment[]>([]);
  const [activeSelection, setActiveSelection] = useState<string>("");
  const [draftInstruction, setDraftInstruction] = useState("");
  const [isRefining, setIsRefining] = useState(false);

  if (!criteria || !rawJD) {
    return (
      <EmptyState
        title="No headlines to review yet"
        description="Refine a job description first so the assistant can produce structured must-haves, nice-to-haves, and red flags."
        actionHref="/upload-jd"
        actionLabel="Upload job description"
      />
    );
  }

  function handleConfirm() {
    const cleanedCriteria = cleanCriteria(draft);

    if (
      cleanedCriteria.mustHave.length === 0 &&
      cleanedCriteria.nice2Have.length === 0 &&
      cleanedCriteria.redFlags.length === 0
    ) {
      setError("Keep at least one criterion before moving to resume upload.");
      return;
    }

    updateCriteria(cleanedCriteria);
    router.push("/upload-resumes");
  }

  function captureSelection() {
    const selection = window.getSelection()?.toString().trim();
    if (selection) {
      setActiveSelection(selection);
    }
  }

  function handleAddComment() {
    if (!draftInstruction.trim() || !activeSelection) return;
    setComments([...comments, { selectedText: activeSelection, instruction: draftInstruction.trim() }]);
    setDraftInstruction("");
    setActiveSelection("");
    window.getSelection()?.removeAllRanges();
  }

  function handleCancelComment() {
    setDraftInstruction("");
    setActiveSelection("");
    window.getSelection()?.removeAllRanges();
  }

  function removeComment(index: number) {
    setComments(comments.filter((_, i) => i !== index));
  }

  async function handleRefine() {
    if (comments.length === 0) return;
    setIsRefining(true);
    setError("");

    try {
      const response = await refineJobDescription({
        rawJD,
        previousRefinedJD: refinedJD,
        userComments: comments,
      });

      setJobRefinement({
        rawJD,
        refinedJD: response.refinedJD,
        criteria: response.criteria,
        idealCandidateProfile: response.idealCandidateProfile,
      });
      setComments([]);
      setDraft(response.criteria);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The Job Description refinement service did not respond."
      );
    } finally {
      setIsRefining(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Step 2"
        title="Review hiring headlines"
        description="Edit the AI-refined headlines before they become the rubric used to rank resumes. Highlight any text in the Refined Job Description to add feedback and re-refine."
        actions={
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isRefining}
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:opacity-50"
          >
            Confirm headlines
          </button>
        }
      />

      {error ? <ErrorBanner message={error} /> : null}

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Left Column */}
        <div className="space-y-6">
          <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-zinc-950">Refined Job Description</h2>
            <div
              className="mt-3 whitespace-pre-wrap text-sm leading-7 text-zinc-700 selection:bg-emerald-200 selection:text-emerald-900 cursor-text"
              onMouseUp={captureSelection}
            >
              {refinedJD}
            </div>
            {/* Guide for users */}
            <p className="mt-4 text-xs italic text-zinc-500">
              * Select any text above to add an instruction comment and re-refine the JD.
            </p>
          </div>
          
          <CriteriaEditor criteria={draft} onChange={setDraft} />
        </div>

        {/* Right Column */}
        <aside className="space-y-4">
          <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-zinc-950">Ideal candidate profile</h2>
            <p className="mt-3 text-sm leading-7 text-zinc-700">{idealCandidateProfile}</p>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm sticky top-6">
            <h2 className="text-lg font-semibold text-zinc-950 mb-3">Feedback annotations</h2>
            
            {activeSelection && (
              <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 mb-4">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-800">
                  New Comment
                </p>
                <p className="mt-2 text-sm leading-6 text-zinc-700 line-clamp-3 italic">
                  &ldquo;{activeSelection}&rdquo;
                </p>
                <textarea
                  value={draftInstruction}
                  onChange={(e) => setDraftInstruction(e.target.value)}
                  placeholder="What should be changed? e.g. Make this sound more senior."
                  className="mt-3 min-h-[80px] w-full resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                />
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAddComment}
                    disabled={!draftInstruction.trim()}
                    className="inline-flex min-h-8 flex-1 items-center justify-center rounded-md bg-emerald-700 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:opacity-50"
                  >
                    Add Comment
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelComment}
                    className="inline-flex min-h-8 items-center justify-center rounded-md border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {comments.length > 0 && (
              <div className="space-y-3 mb-4 max-h-[300px] overflow-y-auto">
                {comments.map((comment, index) => (
                  <div key={index} className="relative rounded-lg bg-zinc-50 p-3 pr-8 border border-zinc-100">
                    <p className="text-xs leading-5 text-zinc-500 italic line-clamp-2">
                      &ldquo;{comment.selectedText}&rdquo;
                    </p>
                    <p className="mt-1 text-sm font-medium text-zinc-900">
                      {comment.instruction}
                    </p>
                    <button
                      type="button"
                      onClick={() => removeComment(index)}
                      className="absolute right-2 top-2 text-zinc-400 hover:text-rose-600"
                      aria-label="Remove comment"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {!activeSelection && comments.length === 0 && (
              <p className="text-sm text-zinc-500 italic text-center py-4">
                Highlight text in the Job Description to add feedback annotations.
              </p>
            )}

            {comments.length > 0 && (
               <button
                 type="button"
                 onClick={handleRefine}
                 disabled={isRefining}
                 className="flex min-h-12 w-full items-center justify-center rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
               >
                 {isRefining ? "Applying changes..." : `Refine with ${comments.length} comment${comments.length > 1 ? "s" : ""}`}
               </button>
            )}
          </div>
        </aside>
      </section>
    </div>
  );
}

function cleanCriteria(criteria: Criteria): Criteria {
  return {
    mustHave: criteria.mustHave.map((item) => item.trim()).filter(Boolean),
    nice2Have: criteria.nice2Have.map((item) => item.trim()).filter(Boolean),
    redFlags: criteria.redFlags.map((item) => item.trim()).filter(Boolean),
  };
}
