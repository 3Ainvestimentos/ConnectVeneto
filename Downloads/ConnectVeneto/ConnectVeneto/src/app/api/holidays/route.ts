import { NextResponse } from "next/server";
import { z } from "zod";
import {
  OutboundHttpError,
  RequestValidationError,
  internalErrorResponse,
  logSecurityEvent,
  requireCorporateUser,
  safeFetch,
  securityErrorResponse,
  validateSearchParams,
} from "@/lib/security";

interface BrasilApiHoliday {
  date: string;
  name: string;
  type: string;
}

const holidayQuerySchema = z.object({
  year: z.coerce.number().int().min(1900).max(2100),
});

function normalizeToISO(date: string): string {
  return date;
}

export async function GET(request: Request) {
  try {
    await requireCorporateUser(request.headers.get("Authorization"));

    const { year } = validateSearchParams(request.url, holidayQuerySchema);

    const response = await safeFetch(`https://brasilapi.com.br/api/feriados/v1/${year}`, {
      allowedHosts: ["brasilapi.com.br"],
      headers: {
        "Content-Type": "application/json",
      },
      cache: "force-cache",
      timeoutMs: 4000,
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ holidays: [] });
      }

      throw new OutboundHttpError(`Falha na API de feriados (${response.status}).`);
    }

    const json = (await response.json()) as BrasilApiHoliday[];
    const normalized = json.map((holiday) => ({
      dateISO: normalizeToISO(holiday.date),
      name: holiday.name,
      type: holiday.type || "nacional",
    }));

    return NextResponse.json({ holidays: normalized });
  } catch (error) {
    const knownSecurityError = securityErrorResponse(error);
    if (knownSecurityError) {
      logSecurityEvent("[api/holidays] security error", {
        error: error instanceof Error ? error.message : "unknown",
      });
      return knownSecurityError;
    }

    if (error instanceof RequestValidationError) {
      return NextResponse.json({ error: "Parametro year invalido." }, { status: error.status });
    }

    if (error instanceof OutboundHttpError) {
      logSecurityEvent("[api/holidays] outbound error", {
        error: error.message,
        status: error.status,
      });
      return internalErrorResponse("Nao foi possivel carregar os feriados.");
    }

    logSecurityEvent("[api/holidays] unexpected error", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return internalErrorResponse("Nao foi possivel carregar os feriados.");
  }
}
