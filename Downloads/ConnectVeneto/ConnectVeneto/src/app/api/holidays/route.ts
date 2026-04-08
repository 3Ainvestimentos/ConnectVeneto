import { NextResponse } from "next/server";
import { verifyCorporateRequest } from "@/lib/api-auth";

interface BrasilApiHoliday {
  date: string;
  name: string;
  type: string;
}

function normalizeToISO(date: string): string {
  // A BrasilAPI já devolve YYYY-MM-DD
  return date;
}

export async function GET(request: Request) {
  try {
    const authorizationHeader = request.headers.get("Authorization");
    // Valida o domínio (venetomfo.com.br)
    await verifyCorporateRequest(authorizationHeader);

    const { searchParams } = new URL(request.url);
    const year = Number(searchParams.get("year"));

    if (!Number.isInteger(year) || year < 1900 || year > 2100) {
      return NextResponse.json({ error: "Parametro year invalido." }, { status: 400 });
    }

    // Usar a BrasilAPI (pública e gratuita, sem necessidade de KEY)
    const response = await fetch(`https://brasilapi.com.br/api/feriados/v1/${year}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      // cache: "force-cache" é ideal aqui pois feriados de um ano não mudam
      cache: "force-cache", 
    });

    if (!response.ok) {
      if (response.status === 404) {
         // BrasilAPI pode retornar 404 se o ano for muito fora do padrão, tratamos como lista vazia
         return NextResponse.json({ holidays: [] });
      }
      throw new Error(`Falha na API de feriados (${response.status}).`);
    }

    const json = (await response.json()) as BrasilApiHoliday[];
    
    // Normalizar a resposta para o formato que a Intranet espera
    const normalized = json.map((holiday) => ({
      dateISO: normalizeToISO(holiday.date),
      name: holiday.name,
      type: holiday.type || "nacional", // BrasilAPI retorna feriados nacionais por padrão aqui
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
