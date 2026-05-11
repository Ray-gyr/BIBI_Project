import { NextRequest, NextResponse } from "next/server";
import { JDInputSchema } from "@/lib/langchain/jd-schemas";
import { refineJD } from "@/lib/langchain/jd-refiner";
import { z } from "zod";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // 1. Validate the input using Zod (Defensive Programming)
    const validatedInput = JDInputSchema.parse(body);

    // 2. Call the LangChain service
    const result = await refineJD(validatedInput);

    // 3. Return the successful response
    return NextResponse.json(result, { status: 200 });

  } catch (error) {
    console.error("Error in /api/jd/refine:", error);

    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation Error", details: error.errors },
        { status: 400 }
      );
    }

    // Handle generic errors (e.g., LangChain/API failure)
    return NextResponse.json(
      { error: "Internal Server Error", message: (error as Error).message },
      { status: 500 }
    );
  }
}
