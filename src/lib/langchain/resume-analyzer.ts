import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatPromptTemplate, SystemMessagePromptTemplate, HumanMessagePromptTemplate } from "@langchain/core/prompts";
import {
  Api2InputType,
  Api2OutputType,
  Api3InputType,
  Api3OutputType,
  CandidateSummarySchema,
  Api3OutputSchema,
  CandidateSummaryType,
  CommentArraySchema,
  CandidateDetailSummarySchema
} from "./resume-schemas";

// Utility for concurrency limiting (sliding window pool)
async function runWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;

  const worker = async () => {
    while (index < items.length) {
      const currentIndex = index++;
      results[currentIndex] = await fn(items[currentIndex]);
    }
  };

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);

  return results;
}

// --- Prompts for API 2 ---

const API2_SYSTEM_PROMPT = `
You are an expert hiring panel consisting of three personas:
1. recruiter: Evaluates match with JD, candidate "sellability", STAR method usage, stability, and education.
2. hiringManager: Evaluates basic requirements, location/logistics, soft skills, and career gaps.
3. teamLead: Evaluates technical depth, system design, problem-solving, and immediate project impact.

Your task is to review a candidate's resume against the Job Description criteria and the Ideal Candidate Profile.

Output Requirements:
1. Name: Extract the candidate's full name.
2. Tier: Assign one of ["Strong Hire", "Hire", "Maybe", "No"]. 
3. Consensus: A brief summary of what all three roles agree on regarding the candidate.
4. Conflicts: Explicitly state where the roles disagree in 1 short sentence (e.g., "recruiter likes the pedigree, but teamLead worries about lack of modern tech stack"). If no conflicts, just say "None".

Tier explanation:
1.Strong Hire: Exceptional match. Meets all Must-haves and about 80% of Nice-to-haves. Demonstrates high technical maturity and zero red flags.
2. Hire: Solid match. Meets all Must-haves. Possesses core competencies required for the role with minor gaps in non-essential "bonus" areas.
3. Maybe: Borderline match. Meets core Must-haves but shows "Unclear" signals or minor Red Flags that require manual recruiter verification.
No: Automatic rejection. Fails one or more Must-haves or triggers significant, non-negotiable Red Flags defined in the JD.

Implementation Tips for the Summarizer
1. Strict Logic: If a Must-have is missing, the candidate cannot be a "Strong Hire" or "Hire" regardless of other skills.
2. Conflict Resolution: If the Team Lead says "Strong Hire" but HR says "No" due to a Red Flag, the Summarizer must default to No or Maybe and explain the conflict.
3. Evidence-Based: Ensure the LLM cites specific chunks when justifying the "Maybe" or "No" categories.
`;

const API2_HUMAN_PROMPT = `
JD Criteria (Must Haves, Nice To Haves, Red Flags):
{criteria}

Ideal Candidate Profile:
{idealCandidateProfile}

Candidate Resume:
{resumeText}
`;

// --- Prompts for API 3 ---

// Step 1: Removed (Replaced by quote-based approach)

// Step 2: Isolated Agent Prompts
const getAgentPrompt = (role: string, focus: string) => `
You are a(n) ${role}. Your focus is: ${focus}.
You will be provided with a candidate's full resume text, and the Job Description criteria.

Task:
- Review the resume text.
- For parts of the resume that contain notable information relevant to your focus, generate a concise comment.
- type: "meets" (strong match), "unclear" (ambiguous), "gap" (missing or red flag).
- text: The actual insight from your specific perspective. Be extremely concise and punchy (1-2 short sentences max).
- quote: Extract the exact substring from the resume that this comment refers to. Do not paraphrase it.
- role: Must strictly be "${role}".

Note: Only highlight points relevant to your role. Keep outputs brief.
Strictly adhere to the provided JSON schema.
`;

const API3_AGENT_HUMAN_PROMPT = `
JD Criteria:
{criteria}

Resume Text:
{resumeText}
`;

// Step 3: Summary LLM
const API3_SUMMARY_SYSTEM_PROMPT = `
You are a Senior Review Panelist. Three independent agents (recruiter, hiringManager, teamLead) have just reviewed a candidate's resume and provided specific comments on various chunks of the text.

Your task is to:
1. 'overview': Synthesize the viewpoints of the three agents into a unified, concise summary (2-3 sentences max).
2. 'interviewQuestions': Identify any doubts, "unclear" tags, or "gap" tags raised by the agents, and formulate short, direct interview questions to address these concerns during an interview. Keep the questions brief.

Strictly adhere to the provided JSON schema.
`;

const API3_SUMMARY_HUMAN_PROMPT = `
Agent Comments:
{agentComments}
`;


function getModel(temperature: number = 0.2) {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_API_KEY is not defined in environment variables.");
  }
  return new ChatGoogleGenerativeAI({
    model: "gemini-3-flash-preview",
    temperature,
    apiKey,
  });
}

// --- API 2 Core Function ---

async function analyzeSingleResume(
  resume: { id: number, filename: string, text: string },
  criteria: any,
  idealCandidateProfile: string
): Promise<CandidateSummaryType> {
  const model = getModel(0.2);
  const structuredModel = model.withStructuredOutput(CandidateSummarySchema);

  const prompt = ChatPromptTemplate.fromMessages([
    SystemMessagePromptTemplate.fromTemplate(API2_SYSTEM_PROMPT),
    HumanMessagePromptTemplate.fromTemplate(API2_HUMAN_PROMPT)
  ]);

  const chain = prompt.pipe(structuredModel);

  const response = await chain.invoke({
    criteria: JSON.stringify(criteria, null, 2),
    idealCandidateProfile,
    resumeText: resume.text
  });

  // Ensure the ID maps back to the frontend's provided ID
  return {
    ...response,
    id: resume.id
  };
}

export async function analyzeResumesBatch(input: Api2InputType): Promise<Api2OutputType> {
  const CONCURRENCY_LIMIT = 10;

  // Process all resumes through the single-pass panel prompt
  const results = await runWithConcurrency(
    input.resumes,
    CONCURRENCY_LIMIT,
    (resume) => analyzeSingleResume(resume, input.criteria, input.idealCandidateProfile)
  );

  // Sort by tier: Strong Hire > Hire > Maybe > No
  const tierWeight = {
    "Strong Hire": 4,
    "Hire": 3,
    "Maybe": 2,
    "No": 1
  };

  const sortedCandidates = results.sort((a, b) => tierWeight[b.tier] - tierWeight[a.tier]);

  return {
    candidates: sortedCandidates
  };
}

// --- API 3 Core Function ---

export async function analyzeCandidateDetail(input: Api3InputType): Promise<Api3OutputType> {
  const criteriaJson = JSON.stringify(input.criteria, null, 2);

  // Define the isolated roles
  const roles = [
  { 
    name: "recruiter", 
    focus: "Strategic talent scout: Focus on career trajectory and growth signals. Identify 'hidden gems' by looking past formatting to find consistent professional progression and high-level strategic alignment with the JD." 
  },
  { 
    name: "hiringManager", 
    focus: "Organizational architect: Evaluate narrative consistency and soft-skill evidence. Assess if the candidate's experience justifies their seniority and if their communication style suggests a high-impact team fit." 
  },
  { 
    name: "teamLead", 
    focus: "Technical auditor: Perform a deep semantic scan for 'logic holes' in project descriptions. Look for engineering maturity in system design choices and detect contradictions between claimed skills and actual project complexity. Ignore buzzword density in favor of proof of work." 
  }
  ];

  // Step 2: Run isolated agents in parallel
  const agentPromises = roles.map(async (roleDef) => {
    const agentModel = getModel(0.2).withStructuredOutput(CommentArraySchema);
    const agentPrompt = ChatPromptTemplate.fromMessages([
      SystemMessagePromptTemplate.fromTemplate(getAgentPrompt(roleDef.name, roleDef.focus)),
      HumanMessagePromptTemplate.fromTemplate(API3_AGENT_HUMAN_PROMPT)
    ]);
    const agentChain = agentPrompt.pipe(agentModel);
    return agentChain.invoke({ criteria: criteriaJson, resumeText: input.resumeText });
  });

  const agentResults = await Promise.all(agentPromises);

  // Combine all comments from the isolated agents
  const allComments = agentResults.flatMap(result => result.comments);

  // Step 3: Run Summary LLM based on agent comments
  const summaryModel = getModel(0.2).withStructuredOutput(CandidateDetailSummarySchema);
  const summaryPrompt = ChatPromptTemplate.fromMessages([
    SystemMessagePromptTemplate.fromTemplate(API3_SUMMARY_SYSTEM_PROMPT),
    HumanMessagePromptTemplate.fromTemplate(API3_SUMMARY_HUMAN_PROMPT)
  ]);
  const summaryChain = summaryPrompt.pipe(summaryModel);
  const summaryResponse = await summaryChain.invoke({
    agentComments: JSON.stringify(allComments, null, 2)
  });

  return {
    comments: allComments,
    summary: summaryResponse
  };
}
