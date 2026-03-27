# Fase 4 — Qualidade: Gates Incrementais de TypeScript, Lint e Testes

## Princípio geral

Ativar verificações de qualidade em camadas, do núcleo para fora, sem quebrar o build de produção existente. Cada camada é uma PR pequena e verificável.

---

## 1. TypeScript — Ativação Gradual

### Estado atual
- `tsconfig.json` tem `strict: true` mas `next.config.ts` usa `typescript.ignoreBuildErrors: true`, desativando erros no build.
- Existem erros pré-existentes, concentrados em: `opportunity-map/`, `bob-v2/`, formulários de workflow, tipos implícitos `any`.

### Estratégia incremental (por camada)

| Ordem | Escopo | Ação |
|-------|--------|------|
| 1 | `src/lib/` + `src/hooks/` | Resolver todos os erros TS — arquivos sem dependências externas complexas |
| 2 | `src/contexts/` | Tipar corretamente os contextos já refatorados (Auth, Workflows, Vacations) |
| 3 | `src/components/ui/` + `src/components/error/` | Componentes folha sem lógica de negócio |
| 4 | `src/app/(auth)/` + `src/app/api/` | Rotas de autenticação e APIs server-side |
| 5 | `src/app/(app)/` (exceto pages mortas) | Páginas principais da aplicação |
| 6 | Remover `typescript.ignoreBuildErrors: true` | Apenas quando camadas 1–5 estiverem limpas |

### Como validar cada camada
```bash
npx tsc --noEmit --strict false 2>&1 | grep "src/lib/"
```
Trocar `src/lib/` pelo escopo da camada sendo validada.

---

## 2. ESLint — Ativação Gradual

### Estado atual
- ESLint configurado mas ignorado no build (`eslint.ignoreDuringBuilds: true` em `next.config.ts`).
- Warnings ativos no dev: principalmente `@typescript-eslint/no-unused-vars`, `@typescript-eslint/no-explicit-any`, `react-hooks/exhaustive-deps`.

### Estratégia incremental

| Ordem | Regra | Ação |
|-------|-------|------|
| 1 | `no-unused-vars` | Corrigir em `src/lib/` e `src/hooks/` (já baixo impacto) |
| 2 | `no-unused-vars` | Corrigir em `src/contexts/` (focar nos contextos já tocados) |
| 3 | `react-hooks/exhaustive-deps` | Corrigir em hooks e contextos (alto risco — revisar com cuidado) |
| 4 | `no-explicit-any` | Substituir `any` por tipos explícitos nos arquivos mais críticos |
| 5 | Remover `eslint.ignoreDuringBuilds: true` | Quando regras 1–3 estiverem limpas |

### Regra de ouro para `exhaustive-deps`
Ao adicionar uma dep ausente a um `useEffect`, verificar se a nova dep é estável (`useCallback`, `useRef`, constante de módulo) para não criar loops de re-render.

---

## 3. Testes — Cenários Críticos

### Stack sugerida (sem adicionar dependências ainda)
- **Unit/Integration**: Vitest + `@testing-library/react` (compatível com Next.js 15 + App Router)
- **E2E leve**: Playwright (já é dep do ecossistema Next.js)

### Cenários de teste por prioridade

#### P0 — Bloqueadores de produção
| Cenário | Arquivo alvo |
|---------|-------------|
| Login com email corporativo → redireciona ao dashboard | `AuthContext` + login page |
| Login com email não corporativo → acesso negado | `AuthContext` |
| Modo manutenção → bloqueia não-admins | `AuthContext` |
| Cookie `cv_auth` ausente → middleware redireciona para login | `middleware.ts` |

#### P1 — Fluxos de negócio core
| Cenário | Arquivo alvo |
|---------|-------------|
| `useFirestoreCollection` retorna dados + listener ativa sem erro | `useFirestoreCollection.ts` |
| `useCollaboratorSync` encontra collab por UID e chama onUpdate | `useCollaboratorSync.ts` |
| `updateRequestAndNotify` notifica solicitante corretamente | `WorkflowsContext` |
| RSS API rejeita request sem token | `src/app/api/rss/route.ts` |
| RSS API rejeita URL fora da whitelist | `src/app/api/rss/route.ts` |

#### P2 — Permissões e guards
| Cenário | Arquivo alvo |
|---------|-------------|
| Admin sem `canManageWorkflows` → não aparece no nav | `AppLayout` permissions |
| SuperAdmin tem acesso a todas as permissões | `AuthContext` |
| `AdminGuard` bloqueia não-admins | `AdminGuard.tsx` |

### Estrutura de pastas sugerida
```
src/
  __tests__/
    hooks/
      useFirestoreCollection.test.ts
      useCollaboratorSync.test.ts
    contexts/
      AuthContext.test.tsx
    api/
      rss.test.ts
```

---

## 4. Checklist de Execução (Por PR)

Antes de cada PR de qualidade:
- [ ] `npm run build` passa sem erros
- [ ] Lint no escopo modificado: `npx eslint src/lib/ src/hooks/` (ajustar escopo)
- [ ] Nenhum novo `any` introduzido
- [ ] Nenhum `console.log` de debug introduzido
- [ ] Testes do escopo tocado: `npx vitest run src/__tests__/hooks/`

---

## 5. Próximas ações concretas

1. Instalar dependências de test (proposta, aguardando aprovação):
   ```bash
   npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
   ```
2. Configurar `vitest.config.ts` com ambiente `jsdom` e alias `@/`.
3. Escrever primeiros testes P0 para `middleware.ts` e `useFirestoreCollection`.
4. Ativar TypeScript na camada 1 (`src/lib/` + `src/hooks/`) e corrigir.
5. Ativar ESLint na camada 1 e corrigir `no-unused-vars`.
