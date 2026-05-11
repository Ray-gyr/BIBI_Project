# Slate

> *A slate isn't a list of applicants. It's a list of people worth hiring.*

Most recruiting tools help you filter faster. Slate helps you **choose better**.

---

## The Problem

Recruiting has a **selection** problem, not a filtering problem.

When criteria are vague, recruiters default to elimination — cutting obvious mismatches instead of confidently identifying the right person. The result: false positives slip through, hiring managers push back, and the shortlist reflects who *survived* the process rather than who's actually best for the role.

Traditional ATS tools match keywords, not capability. And aligning a recruiter, hiring manager, and tech lead on the same candidate means three separate reviews and a meeting nobody has time for.

---

## The Solution

Slate gives one recruiter the perspective of three experts, grounded in criteria they define and control.

No new workflow. No black-box scores. AI assists the decision — it doesn't make it.

---

## Key Features

**1. JD Refinement & Criteria Extraction**
Upload any job description. Slate rewrites it and extracts three evaluation dimensions the recruiter confirms before any resume is touched:

- **Must-Meet** — Hard requirements. Absence = rejection.
- **Nice-to-Have** — Signals that predict excellence, not just qualification.
- **Red Flags** — Patterns that predict failure in this specific role.

**2. Three-Agent Resume Analysis**
Every resume is evaluated by three specialized agents simultaneously:

| Agent | Focus |
|---|---|
| **Recruiter** | Focuses on strategic alignment, career trajectory, and overall experience level |
| **Hiring Manager** | Evaluates organizational fit, soft skills, communication clarity, and long-term stability |
| **Tech Lead** | Scrutinizes technical depth, identifies logical gaps in project descriptions, and assesses hard-skill proficiency |

Each agent cites specific quotes from the resume with `Meets / Unclear / Gap` judgments anchored to confirmed criteria.

**3. Tier Ranking, Not Scores**
Candidates are placed into `Strong Yes / Yes / Maybe / No`. Deliberate choice — numeric scores create false precision. The difference between 74 and 76 is noise. Tiers aren't.

**4. On-Demand Deep Analysis**
Bulk tier assignment runs lightweight. Full quote-level reasoning, conflict detection between agents, and AI-generated interview questions only trigger when a recruiter clicks in. Fast where it needs to be fast. Deep where it needs to be deep.

---

## Benefits

- **Filter → Select**: shifts recruiter mindset from elimination to active choice
- **Zero learning curve**: same workflow, AI added in — nothing restructured
- **Multi-perspective alignment without the meeting**: recruiter sees all three lenses before the shortlist goes out
- **Fewer false positives**: semantic evaluation catches candidates who look good on paper but can't do the job
- **Fewer manual steps**: raw JD to annotated shortlist with one human checkpoint

---

## Architecture

### Pipeline

Upload JD
→ LLM refines JD + extracts criteria
→ Recruiter confirms/edits
→ Upload resumes (PDF → text via pdf.js)
→ 3 agents assign tier per candidate
→ Recruiter clicks candidate
→ 3 agents run quote-level analysis
→ Summarizer agent: consensus + conflicts + interview questions



### Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js, Tailwind CSS |
| Orchestration | LangChain |
| LLM | Gemini 3.0 Flash |
| PDF Parsing | pdf.js (client-side) |

**Why Gemini 3.0 Flash?**
Slate runs 4 LLM calls per candidate. Cost compounds. Flash is the most affordable Tier-1 model with enough reasoning depth for semantic resume evaluation and strict JSON output— no Pro-tier capability needed, no Pro-tier price paid.

## Environment

Create `.env.local` from `.env.example` and set the Gemini API key before running the app:

```bash
cp .env.example .env.local
```

```bash
GOOGLE_API_KEY=replace-with-your-google-ai-api-key
```

Restart `npm run dev` after changing `.env.local`; Next.js reads server environment variables at startup.

## Production Access Control

Production deployments require Basic Auth before any app or API route is accessible:

```bash
BIBI_APP_USERNAME=slate
BIBI_APP_PASSWORD=replace-with-a-long-random-password
```

If `BIBI_APP_PASSWORD` is missing or shorter than 16 characters in production, the app fails closed with `503`.


*Built at [BIBI] · Presented at Google*
