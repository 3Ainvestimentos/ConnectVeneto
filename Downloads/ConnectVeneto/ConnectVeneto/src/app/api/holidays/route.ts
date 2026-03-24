import { NextResponse } from "next/server";
import { verifyCorporateRequest } from "@/lib/api-auth";

interface FeriadosApiHoliday {
  data: string;
  nome: string;
  tipo: string;
}

interface FeriadosApiResponse {
  feriados?: FeriadosApiHoliday[];
}

function normalizeToISO(date: string): string {
  if (date.includes("-")) {
    return date;
  }

  const [day, month, year] = date.split("/");
  if (!day || !month || !year) {
    throw new Error("Formato de data invalido retornado pela API de feriados.");
  }
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function getApiConfig() {
  const apiBaseUrl = process.env.FERIADOS_API_BASE_URL ?? "https://feriadosapi.com";
  const apiKey = process.env.FERIADOS_API_KEY;
  return { apiBaseUrl, apiKey };
}

async function callFeriadosApi(url: string, apiKey: string) {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Falha na API de feriados (${response.status}).`);
  }

  const json = (await response.json()) as FeriadosApiResponse;
  return json.feriados ?? [];
}

export async function GET(request: Request) {
  try {
    const authorizationHeader = request.headers.get("Authorization");
    await verifyCorporateRequest(authorizationHeader);

    const { apiBaseUrl, apiKey } = getApiConfig();
    if (!apiKey) {
      return NextResponse.json(
        { error: "FERIADOS_API_KEY nao configurada no ambiente." },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const year = Number(searchParams.get("year"));

    if (!Number.isInteger(year) || year < 1900 || year > 2100) {
      return NextResponse.json({ error: "Parametro year invalido." }, { status: 400 });
    }

    const nationalEndpoint = `${apiBaseUrl}/api/v1/feriados/nacionais?ano=${year}`;
    const feriados = await callFeriadosApi(nationalEndpoint, apiKey);

    const normalized = feriados.map((holiday) => ({
      dateISO: normalizeToISO(holiday.data),
      name: holiday.nome,
      type: holiday.tipo,
    }));

    return NextResponse.json({ holidays: normalized });
  } catch (error) {
    console.error("Erro ao carregar feriados:", error);

    if ((error as Error)?.message === "UNAUTHORIZED_MISSING_TOKEN" || (error as Error)?.message === "UNAUTHORIZED_INVALID_TOKEN") {
      return NextResponse.json({ error: "Nao autorizado: token nao fornecido." }, { status: 401 });
    }

    if ((error as Error)?.message === "FORBIDDEN_NON_CORPORATE_EMAIL") {
      return NextResponse.json({ error: "Acesso negado: apenas contas corporativas podem acessar." }, { status: 403 });
    }

    return NextResponse.json({ error: "Nao foi possivel carregar os feriados." }, { status: 500 });
  }
}
