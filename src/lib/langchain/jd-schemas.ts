import { z } from "zod";

const MAX_CRITERIA_ITEMS = 25;
const MAX_CRITERION_LENGTH = 500;

const CriterionListSchema = z
  .array(z.string().trim().min(1).max(MAX_CRITERION_LENGTH))
  .max(MAX_CRITERIA_ITEMS);

export const CriteriaSchema = z
  .object({
    mustHave: CriterionListSchema.describe("Must-haves: absence = automatic rejection."),
    nice2Have: CriterionListSchema.describe(
      "Nice-to-haves: predicts ability to do the actual job well.",
    ),
    redFlags: CriterionListSchema.describe("Red flags: signals that predict failure."),
  })
  .strict();

export const JDInputSchema = z
  .object({
    rawJD: z
      .string()
      .min(50, "Job description is too short to process.")
      .max(10000, "Job description is too long."),
    previousRefinedJD: z.string().max(20000, "Previous job description is too long.").optional(),
    userComments: z
      .array(
        z
          .object({
            selectedText: z.string().max(2000),
            instruction: z.string().max(1000),
          })
          .strict(),
      )
      .max(20, "Too many feedback annotations.")
      .optional(),
  })
  .strict();

export const JDOutputSchema = z
  .object({
    refinedJD: z
      .string()
      .max(20000)
      .describe("The rewritten, cleaner, and more specific job description."),
    criteria: CriteriaSchema,
    idealCandidateProfile: z
      .string()
      .max(2000)
      .describe("2-3 sentence description of perfect candidate used as anchor for tier calibration."),
  })
  .strict();

export type JDInputType = z.infer<typeof JDInputSchema>;
export type JDOutputType = z.infer<typeof JDOutputSchema>;
