import { NextResponse } from "next/server";
import { analyzeResumesBatch } from "@/lib/langchain/resume-analyzer";
import { Api2InputSchema } from "@/lib/langchain/resume-schemas";
import {
  internalErrorResponse,
  logRouteError,
  serviceUnavailableResponse,
  validateJsonRequest,
} from "@/lib/server/api-security";

const MAX_ANALYZE_BODY_BYTES = 1_200_000;

export async function POST(request: Request) {
  if (!process.env.GOOGLE_API_KEY) {
    return serviceUnavailableResponse();
  }

  const validation = await validateJsonRequest(request, Api2InputSchema, {
    maxBytes: MAX_ANALYZE_BODY_BYTES,
  });

  if (!validation.ok) {
    return validation.response;
  }

  try {
    const result = await analyzeResumesBatch(validation.data);
    return NextResponse.json(result);
  } catch (error: unknown) {
    logRouteError("/api/analyze-resumes", error);
    return internalErrorResponse();
  }
}
