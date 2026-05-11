import { z } from "zod";

export const JDInputSchema = z.object({
  rawJD: z.string().min(50, "Job description is too short to process.").max(10000, "Job description is too long."),
  userComment: z.object({
    selectedText: z.string().max(2000),
    instruction: z.string().max(1000)
  }).optional()
});

export const JDOutputSchema = z.object({
  refinedJD: z.string().describe("The rewritten, cleaner, and more specific job description."),
  criteria: z.object({
    mustHave: z.array(z.string()).describe("Must-haves: absence = automatic rejection."),
    nice2Have: z.array(z.string()).describe("Nice-to-haves: predicts ability to do the actual job well."),
    redFlags: z.array(z.string()).describe("Red flags: signals that predict failure.")
  }),
  idealCandidateProfile: z.string().describe("2-3 sentence description of perfect candidate used as anchor for tier calibration.")
});

export type JDInputType = z.infer<typeof JDInputSchema>;
export type JDOutputType = z.infer<typeof JDOutputSchema>;
