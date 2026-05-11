import { z } from "zod";
import { JDOutputSchema } from "./jd-schemas";

const MAX_RESUMES_PER_REQUEST = 10;
const MAX_RESUME_TEXT_LENGTH = 100_000;
const MAX_FILENAME_LENGTH = 255;
const MAX_COMMENTS = 60;
const MAX_INTERVIEW_QUESTIONS = 10;

// --- API 2: Resume Analysis (Batch) ---

const ResumeInputSchema = z
  .object({
    id: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    filename: z.string().min(1).max(MAX_FILENAME_LENGTH),
    text: z.string().min(20).max(MAX_RESUME_TEXT_LENGTH),
  })
  .strict();

export const Api2InputSchema = z
  .object({
    criteria: JDOutputSchema.shape.criteria,
    idealCandidateProfile: JDOutputSchema.shape.idealCandidateProfile,
    resumes: z.array(ResumeInputSchema).min(1).max(MAX_RESUMES_PER_REQUEST),
  })
  .strict()
  .superRefine((input, context) => {
    const seenIds = new Set<number>();

    input.resumes.forEach((resume, index) => {
      if (seenIds.has(resume.id)) {
        context.addIssue({
          code: "custom",
          path: ["resumes", index, "id"],
          message: "Resume IDs must be unique.",
        });
      }

      seenIds.add(resume.id);
    });
  });

export const CandidateSummarySchema = z
  .object({
    id: z.number().int().describe("The same integer id as the input resume"),
    name: z.string().max(200).describe("Extracted candidate name"),
    tier: z.enum(["Strong Hire", "Hire", "Maybe", "No"]),
    summary: z
      .object({
        consensus: z
          .string()
          .max(1500)
          .describe("What the Recruiter, HR, and Team Lead agreed on"),
        conflicts: z
          .string()
          .max(1000)
          .describe("Where the roles disagreed, explicitly stated"),
      })
      .strict(),
  })
  .strict();

export const Api2OutputSchema = z
  .object({
    candidates: z.array(CandidateSummarySchema).max(MAX_RESUMES_PER_REQUEST),
  })
  .strict();

// Types for API 2
export type Api2InputType = z.infer<typeof Api2InputSchema>;
export type Api2OutputType = z.infer<typeof Api2OutputSchema>;
export type CandidateSummaryType = z.infer<typeof CandidateSummarySchema>;


// --- API 3: Candidate Detail (Deep Analysis) ---

export const Api3InputSchema = z
  .object({
    candidateId: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    resumeText: z.string().min(20).max(MAX_RESUME_TEXT_LENGTH),
    criteria: JDOutputSchema.shape.criteria,
  })
  .strict();

export const CommentSchema = z
  .object({
    quote: z
      .string()
      .max(1000)
      .describe("The exact quote from the resume this comment refers to"),
    role: z.enum(["recruiter", "hiringManager", "teamLead"]),
    type: z.enum(["meets", "unclear", "gap"]),
    text: z
      .string()
      .max(1500)
      .describe("The actual AI comment from the specific role's perspective"),
  })
  .strict();

export const CandidateDetailSummarySchema = z
  .object({
    overview: z.string().max(2000).describe("Consolidated viewpoint from all three agents"),
    interviewQuestions: z
      .array(z.string().max(500))
      .max(MAX_INTERVIEW_QUESTIONS)
      .describe("Questions based on doubts, unclear points, or gaps"),
  })
  .strict();

export const Api3OutputSchema = z
  .object({
    comments: z.array(CommentSchema).max(MAX_COMMENTS),
    summary: CandidateDetailSummarySchema,
  })
  .strict();

export const CommentArraySchema = z
  .object({
    comments: z.array(CommentSchema).max(20),
  })
  .strict();

// Types for API 3
export type Api3InputType = z.infer<typeof Api3InputSchema>;
export type Api3OutputType = z.infer<typeof Api3OutputSchema>;
export type CommentType = z.infer<typeof CommentSchema>;
