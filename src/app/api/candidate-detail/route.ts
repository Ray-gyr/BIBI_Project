import { NextResponse } from "next/server";
import { analyzeCandidateDetail } from "@/lib/langchain/resume-analyzer";
import { Api3InputSchema } from "@/lib/langchain/resume-schemas";
import {
  internalErrorResponse,
  logRouteError,
  serviceUnavailableResponse,
  validateJsonRequest,
} from "@/lib/server/api-security";

const MAX_CANDIDATE_DETAIL_BODY_BYTES = 250_000;

export async function POST(request: Request) {
  if (!process.env.GOOGLE_API_KEY) {
    return serviceUnavailableResponse();
  }

  const validation = await validateJsonRequest(request, Api3InputSchema, {
    maxBytes: MAX_CANDIDATE_DETAIL_BODY_BYTES,
  });

  if (!validation.ok) {
    return validation.response;
  }

  try {
    const result = await analyzeCandidateDetail(validation.data);
    return NextResponse.json(result);
  } catch (error: unknown) {
    logRouteError("/api/candidate-detail", error);
    return internalErrorResponse();
  }
}
