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
  ChunkArraySchema,
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
4. Conflicts: Explicitly state where the roles disagree (e.g., "recruiter likes the pedigree, but teamLead worries about lack of modern tech stack").

Strictly adhere to the required JSON output schema.
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

// Step 1: Universal Chunking
const API3_CHUNKING_SYSTEM_PROMPT = `
You are a precision document segmenter. Your only task is to break the provided resume into logical text chunks (e.g., bullet points, short paragraphs, or single sentences).

Rules:
- Extract exact substrings from the resume. Do not paraphrase or alter the text.
- Assign a sequential integer id like 1, 2, 3 to each chunk.
- Ensure the chunks collectively cover the most important sections of the resume.

Strictly adhere to the provided JSON schema.
`;

const API3_CHUNKING_HUMAN_PROMPT = `
Candidate Resume:
{resumeText}
`;

// Step 2: Isolated Agent Prompts
const getAgentPrompt = (role: string, focus: string) => `
You are a(n) ${role}. Your focus is: ${focus}.
You will be provided with a candidate's resume that has already been split into chunks (each with an integer ID), and the Job Description criteria.

Task:
- Review the provided chunks.
- For chunks that contain notable information relevant to your focus, generate a comment.
- type: "meets" (strong match), "unclear" (ambiguous), "gap" (missing or red flag).
- text: The actual insight from your specific perspective.
- chunkId: Must exactly match the integer id of the chunk being commented on.
- role: Must strictly be "${role}".

Note: Not all chunks need comments. Only highlight points relevant to your role.
Strictly adhere to the provided JSON schema.
`;

const API3_AGENT_HUMAN_PROMPT = `
JD Criteria:
{criteria}

Resume Chunks:
{chunks}
`;

// Step 3: Summary LLM
const API3_SUMMARY_SYSTEM_PROMPT = `
You are a Senior Review Panelist. Three independent agents (recruiter, hiringManager, teamLead) have just reviewed a candidate's resume and provided specific comments on various chunks of the text.

Your task is to:
1. 'overview': Synthesize the viewpoints of the three agents into a unified summary.
2. 'interviewQuestions': Identify any doubts, "unclear" tags, or "gap" tags raised by the agents, and formulate specific interview questions to address these concerns during an interview.

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
  
  // Step 1: Chunk the resume text (Single LLM Call)
  const chunkingModel = getModel(0.1).withStructuredOutput(ChunkArraySchema);
  const chunkingPrompt = ChatPromptTemplate.fromMessages([
    SystemMessagePromptTemplate.fromTemplate(API3_CHUNKING_SYSTEM_PROMPT),
    HumanMessagePromptTemplate.fromTemplate(API3_CHUNKING_HUMAN_PROMPT)
  ]);
  
  const chunkingChain = chunkingPrompt.pipe(chunkingModel);
  const chunkingResponse = await chunkingChain.invoke({ resumeText: input.resumeText });
  const chunks = chunkingResponse.chunks;
  
  const chunksJson = JSON.stringify(chunks, null, 2);
  const criteriaJson = JSON.stringify(input.criteria, null, 2);

  // Define the isolated roles
  const roles = [
    { name: "recruiter", focus: "Keywords, STAR method, stability, education/background" },
    { name: "hiringManager", focus: "Basic requirements, logistics, soft skills, budget alignment, cultural fit, compliance" },
    { name: "teamLead", focus: "Technical depth, project complexity, system design, immediate project impact, tech stack match" }
  ];

  // Step 2: Run isolated agents in parallel
  const agentPromises = roles.map(async (roleDef) => {
    const agentModel = getModel(0.2).withStructuredOutput(CommentArraySchema);
    const agentPrompt = ChatPromptTemplate.fromMessages([
      SystemMessagePromptTemplate.fromTemplate(getAgentPrompt(roleDef.name, roleDef.focus)),
      HumanMessagePromptTemplate.fromTemplate(API3_AGENT_HUMAN_PROMPT)
    ]);
    const agentChain = agentPrompt.pipe(agentModel);
    return agentChain.invoke({ criteria: criteriaJson, chunks: chunksJson });
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
    chunks: chunks,
    comments: allComments,
    summary: summaryResponse
  };
}
