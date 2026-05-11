import { NextResponse } from "next/server";
import { analyzeResumesBatch } from "@/lib/langchain/resume-analyzer";
import { Api2InputSchema } from "@/lib/langchain/resume-schemas";

export async function POST(request: Request) {
  try {
    // Check for API key existence before processing
    if (!process.env.GOOGLE_API_KEY) {
      return NextResponse.json(
        { error: "GOOGLE_API_KEY is not defined in environment variables." },
        { status: 500 }
      );
    }

    const body = await request.json();
    
    // Validate request body
    const validatedData = Api2InputSchema.safeParse(body);
    
    if (!validatedData.success) {
      return NextResponse.json(
        { error: "Invalid request payload", details: validatedData.error.format() },
        { status: 400 }
      );
    }

    // Call the LangChain pipeline
    const result = await analyzeResumesBatch(validatedData.data);
    
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error in analyze-resumes API:", error);
    return NextResponse.json(
      { error: "Internal server error during resume analysis", details: error.message },
      { status: 500 }
    );
  }
}
