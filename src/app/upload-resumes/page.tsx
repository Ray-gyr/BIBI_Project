"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/EmptyState";
import { ErrorBanner } from "@/components/ErrorBanner";
import { LoadingStages } from "@/components/LoadingStages";
import { PageHeader } from "@/components/PageHeader";
import { ResumeDropzone } from "@/components/ResumeDropzone";
import { analyzeResumes } from "@/lib/api";
import { extractPdfText } from "@/lib/pdf";
import { sleep } from "@/lib/sleep";
import { useRecruitingStore } from "@/store/recruiting-store";
import type { ResumeInput, ResumeRecord } from "@/types";

const MAX_RESUME_BYTES = 10 * 1024 * 1024;
const extractionStages = [
  "Extracting resumes",
  "Validating PDF text",
  "Caching resume text",
  "Ready for AI evaluation",
];

export default function UploadResumesPage() {
  const router = useRouter();
  const {
    criteria,
    idealCandidateProfile,
    resumeTexts,
    resumes,
    addResumes,
    removeResume,
    setCandidates,
  } = useRecruitingStore();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);

  const isBusy = isExtracting || isAnalyzing;
  const uploadedResumeInputs = useMemo<ResumeInput[]>(
    () =>
      resumes
        .map((resume) => ({
          id: resume.id,
          filename: resume.filename,
          text: resumeTexts[String(resume.id)],
        }))
        .filter((resume) => Boolean(resume.text)),
    [resumeTexts, resumes],
  );

  useEffect(() => {
    if (!isBusy) {
      return;
    }

    const timer = setInterval(() => {
      setStageIndex((currentStage) => Math.min(currentStage + 1, 3));
    }, 4500);

    return () => clearInterval(timer);
  }, [isBusy]);

  if (!criteria) {
    return (
      <EmptyState
        title="Criteria are required first"
        description="Confirm the hiring rubric before uploading resumes so every candidate is evaluated against the same criteria."
        actionHref="/review-criteria"
        actionLabel="Review criteria"
      />
    );
  }

  async function handleFilesAccepted(files: File[]) {
    setError("");
    setNotice("");
    setIsExtracting(true);
    setStageIndex(0);

    try {
      const rejected: string[] = [];
      const existingFilenames = new Set(resumes.map((resume) => resume.filename.toLowerCase()));
      const acceptedFiles = files.filter((file) => {
        const normalizedFilename = file.name.toLowerCase();

        if (file.size > MAX_RESUME_BYTES) {
          rejected.push(`${file.name} is larger than ${formatFileSize(MAX_RESUME_BYTES)}.`);
          return false;
        }

        if (existingFilenames.has(normalizedFilename)) {
          rejected.push(`${file.name} is already uploaded.`);
          return false;
        }

        existingFilenames.add(normalizedFilename);
        return true;
      });

      if (acceptedFiles.length === 0) {
        setError(rejected.join(" "));
        return;
      }

      const extractionResults = await Promise.allSettled(
        acceptedFiles.map(async (file) => {
          const text = await extractPdfText(file);
          const id = createResumeId(file.name);
          const record: ResumeRecord = {
            id,
            filename: file.name,
            uploadedAt: new Date().toISOString(),
            wordCount: countWords(text),
            fileSize: file.size,
          };

          return { record, text };
        }),
      );

      const extracted = extractionResults
        .filter((result): result is PromiseFulfilledResult<{ record: ResumeRecord; text: string }> =>
          result.status === "fulfilled",
        )
        .map((result) => result.value);
      const failed = extractionResults
        .filter((result): result is PromiseRejectedResult => result.status === "rejected")
        .map((result) =>
          result.reason instanceof Error ? result.reason.message : "A resume could not be extracted.",
        );

      if (extracted.length > 0) {
        addResumes(
          extracted.map((item) => item.record),
          Object.fromEntries(extracted.map((item) => [String(item.record.id), item.text])),
        );
      }

      if (failed.length > 0 || rejected.length > 0) {
        setError([...rejected, ...failed].join(" "));
      }

      if (extracted.length > 0) {
        setNotice(
          `${extracted.length} resume${extracted.length === 1 ? "" : "s"} extracted and cached.`,
        );
      }
    } catch (extractionError) {
      setError(
        extractionError instanceof Error
          ? extractionError.message
          : "One or more resumes could not be extracted.",
      );
    } finally {
      setIsExtracting(false);
    }
  }

  async function handleAnalyze() {
    setError("");
    setNotice("");

    if (uploadedResumeInputs.length === 0) {
      setError("Upload at least one resume before running the AI evaluation.");
      return;
    }

    if (!criteria) {
      setError("Criteria are not defined.");
      return;
    }

    setIsAnalyzing(true);
    setStageIndex(0);

    try {
      await sleep(350);
      setStageIndex(1);

      const [response] = await Promise.all([
        analyzeResumes({
          criteria,
          idealCandidateProfile,
          resumes: uploadedResumeInputs,
        }),
        sleep(3200),
      ]);

      setStageIndex(3);
      setCandidates(response.candidates);
      await sleep(450);
      router.push("/results");
    } catch (analysisError) {
      setError(
        analysisError instanceof Error
          ? analysisError.message
          : "The resume evaluation service did not respond.",
      );
    } finally {
      setIsAnalyzing(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Step 3"
        title="Upload candidate resumes"
        description="Drop PDF resumes here. Text extraction happens once, then cached text is reused for ranking and candidate drill-downs."
        actions={
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={isBusy || uploadedResumeInputs.length === 0}
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
          >
            {isAnalyzing ? "Analyzing..." : "Analyze resumes"}
          </button>
        }
      />

      {isBusy ? (
        <LoadingStages
          activeIndex={stageIndex}
          stages={isExtracting ? extractionStages : undefined}
        />
      ) : null}
      {error ? <ErrorBanner message={error} /> : null}
      {notice ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">
          {notice}
        </div>
      ) : null}

      <ResumeDropzone
        disabled={isBusy}
        onFilesAccepted={handleFilesAccepted}
        onRejected={setError}
      />

      <section className="rounded-lg border border-zinc-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-4 border-b border-zinc-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-950">Uploaded resumes</h2>
            <p className="mt-1 text-sm text-zinc-600">
              {resumes.length === 0
                ? "No resumes uploaded yet."
                : `${resumes.length} resume${resumes.length === 1 ? "" : "s"} cached in workflow state.`}
            </p>
          </div>
        </div>
        {resumes.length > 0 ? (
          <ul className="divide-y divide-zinc-100">
            {resumes.map((resume) => (
              <li
                key={resume.id}
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold text-zinc-950">{resume.filename}</p>
                  <p className="mt-1 text-sm text-zinc-600">
                    {resume.wordCount.toLocaleString()} words extracted ·{" "}
                    {formatFileSize(resume.fileSize)}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => removeResume(resume.id)}
                  className="inline-flex min-h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-700 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}

function createResumeId(filename: string): number {
  const filenameSeed = Array.from(filename).reduce(
    (total, character) => total + character.charCodeAt(0),
    0,
  );
  const randomSeed = crypto.getRandomValues(new Uint32Array(1))[0];

  return Date.now() + filenameSeed + randomSeed;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "Unknown size";
  }

  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
