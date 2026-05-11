import { NextResponse } from "next/server";
import { JDInputSchema } from "@/lib/langchain/jd-schemas";
import { refineJD } from "@/lib/langchain/jd-refiner";
import {
  internalErrorResponse,
  logRouteError,
  serviceUnavailableResponse,
  validateJsonRequest,
} from "@/lib/server/api-security";

const MAX_REFINE_BODY_BYTES = 80_000;

export async function POST(request: Request) {
  if (!process.env.GOOGLE_API_KEY) {
    return serviceUnavailableResponse();
  }

  const validation = await validateJsonRequest(request, JDInputSchema, {
    maxBytes: MAX_REFINE_BODY_BYTES,
  });

  if (!validation.ok) {
    return validation.response;
  }

  try {
    const result = await refineJD(validation.data);
    return NextResponse.json(result, { status: 200 });
  } catch (error: unknown) {
    logRouteError("/api/jd/refine", error);
    return internalErrorResponse();
  }
}
