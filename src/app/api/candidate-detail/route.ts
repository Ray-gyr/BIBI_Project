import { NextResponse } from "next/server";
import { analyzeCandidateDetail } from "@/lib/langchain/resume-analyzer";
import { Api3InputSchema } from "@/lib/langchain/resume-schemas";

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
    const validatedData = Api3InputSchema.safeParse(body);
    
    if (!validatedData.success) {
      return NextResponse.json(
        { error: "Invalid request payload", details: validatedData.error.format() },
        { status: 400 }
      );
    }

    // Call the LangChain pipeline for detailed chunking and comment generation
    const result = await analyzeCandidateDetail(validatedData.data);
    
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error in candidate-detail API:", error);
    return NextResponse.json(
      { error: "Internal server error during detail analysis", details: error.message },
      { status: 500 }
    );
  }
}
