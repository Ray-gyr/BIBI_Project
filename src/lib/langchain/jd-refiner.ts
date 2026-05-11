import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatPromptTemplate, SystemMessagePromptTemplate, HumanMessagePromptTemplate } from "@langchain/core/prompts";
import { JDInputType, JDOutputSchema, JDOutputType } from "./jd-schemas";

// System prompt space left for the LLM Base Prompt
const SYSTEM_PROMPT = `
Role:
You are a Senior Technical Recruiter and HR Operations Analyst. Your mission is to transform fragmented "Raw JDs" into professional, high-fidelity job descriptions.

Task:
Analyze the provided Raw JD. You must audit for the following Critical Information:
1.Core Tech Stack (Specific languages, frameworks, or tools)
2.Experience Level (Required years of experience)
3.Location (On-site city, Remote, or Hybrid)
4.Compensation (Salary range or equity)
5.Employment Type (Intern, Full-time, or Part-time)
6.Target Cohort (Specifically graduation year requirements for interns/new grads)

Rules for refinedJD:
1.Professionalize the tone and structure (Overview, Responsibilities, Requirements).
2.Mandatory Placeholders: If any of the 6 Critical Information points are missing, you MUST insert [Unknown: <Category Name>] directly into the corresponding section of the refinedJD string. This allows the user to identify and fill gaps easily.

JSON Schema Requirements (Strict Adherence):
1.refinedJD: The polished text with [Unknown: ...] tags integrated.
2.mustHave: Non-negotiable requirements (Deal-breakers).
3.nice2Have: Skills that indicate a top-tier candidate.
4.redFlags: Warning signs (e.g., unrealistic expectations or vague stack).

idealCandidateProfile: 2-3 sentences summarizing the "Perfect Fit" for calibration.
Always return your response strictly matching the requested JSON schema.
`;

// Human prompt base
const HUMAN_PROMPT_BASE = `Here is the raw job description provided by the user:

<raw_jd>
{rawJD}
</raw_jd>
`;

// Human prompt for revisions
const HUMAN_PROMPT_REVISION = `
The user has reviewed a previous version of this job description and provided the following instruction for revision:
<instruction>
{instruction}
</instruction>

This instruction specifically targets or relates to the following text context from the previous version:
<selected_text>
{selectedText}
</selected_text>

Please incorporate this feedback, refine the JD accordingly, and regenerate all criteria based on the updated JD.`;

export async function refineJD(input: JDInputType): Promise<JDOutputType> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_API_KEY is not defined in environment variables.");
  }

  // Initialize the Gemini model via LangChain
  const model = new ChatGoogleGenerativeAI({
    model: "gemini-3-flash-preview",
    temperature: 0.2, // Low temperature for more deterministic/structured output
    apiKey: apiKey,
  });

  // Enforce structured output using Zod schema
  const structuredModel = model.withStructuredOutput(JDOutputSchema);

  let humanPrompt = HUMAN_PROMPT_BASE;
  const promptVariables: Record<string, string> = {
    rawJD: input.rawJD,
  };

  if (input.userComment && input.userComment.instruction) {
    humanPrompt += HUMAN_PROMPT_REVISION;
    promptVariables.instruction = input.userComment.instruction;
    promptVariables.selectedText = input.userComment.selectedText || "";
  }

  const prompt = ChatPromptTemplate.fromMessages([
    SystemMessagePromptTemplate.fromTemplate(SYSTEM_PROMPT),
    HumanMessagePromptTemplate.fromTemplate(humanPrompt)
  ]);

  const chain = prompt.pipe(structuredModel);

  const response = await chain.invoke(promptVariables);

  return response as JDOutputType;
}
