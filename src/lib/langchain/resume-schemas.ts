import { z } from "zod";
import { JDOutputSchema } from "./jd-schemas";

// --- API 2: Resume Analysis (Batch) ---

export const Api2InputSchema = z.object({
  criteria: JDOutputSchema.shape.criteria,
  idealCandidateProfile: JDOutputSchema.shape.idealCandidateProfile,
  resumes: z.array(z.object({
    id: z.number().int(),
    filename: z.string(),
    text: z.string()
  }))
});

export const CandidateSummarySchema = z.object({
  id: z.number().int().describe("The same integer id as the input resume"),
  name: z.string().describe("Extracted candidate name"),
  tier: z.enum(["Strong Hire", "Hire", "Maybe", "No"]),
  summary: z.object({
    consensus: z.string().describe("What the Recruiter, HR, and Team Lead agreed on"),
    conflicts: z.string().describe("Where the roles disagreed, explicitly stated")
  })
});

export const Api2OutputSchema = z.object({
  candidates: z.array(CandidateSummarySchema)
});

// Types for API 2
export type Api2InputType = z.infer<typeof Api2InputSchema>;
export type Api2OutputType = z.infer<typeof Api2OutputSchema>;
export type CandidateSummaryType = z.infer<typeof CandidateSummarySchema>;


// --- API 3: Candidate Detail (Deep Analysis) ---

export const Api3InputSchema = z.object({
  candidateId: z.number().int(),
  resumeText: z.string(),
  criteria: JDOutputSchema.shape.criteria
});

export const ChunkSchema = z.object({
  id: z.number().int().describe("Sequential integer chunk ID, e.g., 1, 2, 3"),
  text: z.string().describe("The exact text of the bullet point or sentence from the resume")
});

export const CommentSchema = z.object({
  chunkId: z.number().int().describe("References the integer chunk id"),
  role: z.enum(["recruiter", "hiringManager", "teamLead"]),
  type: z.enum(["meets", "unclear", "gap"]),
  text: z.string().describe("The actual AI comment from the specific role's perspective")
});

export const CandidateDetailSummarySchema = z.object({
  overview: z.string().describe("Consolidated viewpoint from all three agents"),
  interviewQuestions: z.array(z.string()).describe("Questions based on doubts, unclear points, or gaps")
});

export const Api3OutputSchema = z.object({
  chunks: z.array(ChunkSchema),
  comments: z.array(CommentSchema),
  summary: CandidateDetailSummarySchema
});

export const ChunkArraySchema = z.object({
  chunks: z.array(ChunkSchema)
});

export const CommentArraySchema = z.object({
  comments: z.array(CommentSchema)
});

// Types for API 3
export type Api3InputType = z.infer<typeof Api3InputSchema>;
export type Api3OutputType = z.infer<typeof Api3OutputSchema>;
export type ChunkType = z.infer<typeof ChunkSchema>;
export type CommentType = z.infer<typeof CommentSchema>;
