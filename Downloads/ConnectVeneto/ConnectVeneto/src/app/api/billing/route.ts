
import { NextResponse } from 'next/server';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { verifyCorporateRequest } from '@/lib/api-auth';

// Função para normalizar emails (mesma lógica do AuthContext)
const normalizeEmail = (email: string | null | undefined): string | null => {
    if (!email) return null;
    return email.replace(/@3ariva\.com\.br$/, '@3ainvestimentos.com.br');
};


// Exemplo de dados de faturamento. Em um cenário real, estes dados viriam
// de uma consulta ao BigQuery onde os dados de faturamento do Google Cloud são exportados.
const mockBillingData = {
  currentMonth: "Agosto 2024",
  daysInMonth: 31,
  currentDay: 15,
  services: [
    { id: 'hosting', name: 'App Hosting', cost: 12.50 },
    { id: 'firestore', name: 'Firestore', cost: 25.80 },
    { id: 'storage', name: 'Cloud Storage', cost: 5.20 },
    { id: 'auth', name: 'Authentication', cost: 2.15 },
    { id: 'genkit', name: 'Genkit / AI Models', cost: 45.75 },
  ],
};

export async function GET(request: Request) {
  try {
    // --- Autenticação e Autorização ---
    const authorizationHeader = request.headers.get('Authorization');
    const decodedToken = await verifyCorporateRequest(authorizationHeader);
    const app = getFirebaseAdminApp();

    // --- Verificação de Super Admin ---
    // Busca as configurações do sistema para obter a lista de Super Admins
    const db = getFirestore(app);
    const settingsDoc = await db.collection('systemSettings').doc('config').get();
    
    if (!settingsDoc.exists) {
        throw new Error('Documento de configuração do sistema não encontrado.');
    }

    const settingsData = settingsDoc.data();
    const superAdminEmails = settingsData?.superAdminEmails || [];

    // Normaliza o email do usuário e também os emails da lista para comparar corretamente
    const normalizedUserEmail = normalizeEmail(decodedToken.email);
    const normalizedAdminEmails = superAdminEmails.map(email => normalizeEmail(email)).filter((email): email is string => email !== null);
    
    // Verifica se o email do usuário autenticado está na lista de Super Admins (considerando ambos os formatos)
    if (!normalizedUserEmail || (!normalizedAdminEmails.includes(normalizedUserEmail) && !superAdminEmails.includes(normalizedUserEmail))) {
        return NextResponse.json({ error: 'Acesso negado: Requer permissão de Super Administrador.' }, { status: 403 });
    }

    // --- Lógica de Busca de Dados ---
    // Aqui você implementaria a lógica para buscar os dados de faturamento do Google BigQuery.
    //
    // Exemplo de como seria a lógica (requer configuração prévia):
    //
    // 1. Instale a biblioteca: `npm install @google-cloud/bigquery`
    // 2. Configure a autenticação do serviço (geralmente via variáveis de ambiente).
    // 3. Escreva a query SQL para buscar os custos.
    //
    // const {BigQuery} = require('@google-cloud/bigquery');
    // const bigquery = new BigQuery();
    // const query = `SELECT service.description, SUM(cost) as total_cost
    //                FROM \`YOUR_PROJECT.YOUR_DATASET.gcp_billing_export_v1_XXXXXX\`
    //                WHERE DATE(_PARTITIONTIME) BETWEEN "2024-08-01" AND "2024-08-31"
    //                GROUP BY 1`;
    // const [rows] = await bigquery.query({ query });
    //
    // // Transforme 'rows' no formato esperado pela sua aplicação.
    
    // Por enquanto, retornaremos os dados de exemplo.
    return NextResponse.json(mockBillingData);

  } catch (error: any) {
    console.error("Erro na API de Faturamento:", error);

    if (error?.message === 'UNAUTHORIZED_MISSING_TOKEN' || error?.message === 'UNAUTHORIZED_INVALID_TOKEN') {
      return NextResponse.json({ error: 'Não autorizado: Token não fornecido.' }, { status: 401 });
    }

    if (error?.message === 'FORBIDDEN_NON_CORPORATE_EMAIL') {
      return NextResponse.json({ error: 'Acesso negado: apenas contas corporativas podem acessar.' }, { status: 403 });
    }

    if (error.code === 'auth/id-token-expired' || error.code === 'auth/argument-error') {
       return NextResponse.json({ error: 'Token de autenticação inválido ou expirado.' }, { status: 401 });
    }

    return NextResponse.json({ error: 'Erro interno do servidor ao buscar dados de faturamento.' }, { status: 500 });
  }
}
