---
tipo: pedido
solicitante: sistema-rh
autor: Victor Santos
alvo: connect
data: 2026-11-06
tipo-pedido: modulo-connect
prioridade: normal
status: aberto
---

# Pedido — Cadastrar o Portal RH como módulo `portal-rh` (+ segredo do hub + endpoint de organograma)

## Contexto

O RH pediu que o sistema de avaliação de desempenho (repo `sistema-rh`, Next.js + Prisma +
Supabase, Azure App Service) abra **dentro do Connect** como módulo embarcado, e que as equipes
de avaliação passem a vir do **organograma do Connect** em vez de serem cadastradas à mão.

O lado do módulo está implementado no `sistema-rh` seguindo o protocolo v1.5, **padrão B**
(cookie `SameSite=None; Secure; Partitioned`, como o TrackFlow), porque o app é todo Server
Components + server actions:

- `/embed` com `hub-auth.ts` canônico (v1.2, só o fallback de `MODULE_ID` muda), `/api/hub-verify`
  e `/api/hub-session` (confere `iss: connect-veneto` e `aud: portal-rh`, casa o usuário pelo
  claim `email`; quem não existe é criado como COLABORADOR). O papel interno (RH, gestor, comitê)
  continua definido no próprio Portal RH.
- `CV_MODULE_READY` nos layouts de conteúdo, header próprio escondido no iframe, `?next=` validado.
- CSP `frame-ancestors 'self' https://connect.venetomfo.com.br`, sem `X-Frame-Options`, sem source maps.
- Notificações no sino (`/api/hub/notifications`, `on_resolve`) para as novas sugestões de avaliação
  que o RH aprova; best-effort, nunca derrubam a ação.

Para sincronizar equipes o módulo precisa de unidade e gestor de cada pessoa. O
`/api/hub/members` não traz isso, e o `/api/org/units` exige token de usuário. Daí o endpoint novo.

## O que precisa

1. **Cadastro em Admin → Módulos**, inicialmente **desativado** para teste:
   - `id: portal-rh`, label **Portal RH**, ícone lucide `ClipboardCheck`;
   - `url`: `https://sistema-rh-aggpeafshtcng3d8.canadacentral-01.azurewebsites.net` (origem exata que
     serve o `/embed`, sem redirect), `embedPath: /embed`;
   - `accessMode: all` (todo colaborador avalia), `defaultPermissions: ["portal-rh:view"]`,
     `adminPermissions: ["portal-rh:view", "portal-rh:admin"]`;
   - `permissionCatalog`: `portal-rh:view` "Acessar o Portal RH", `portal-rh:admin` "Administração do Portal RH";
   - `layout: fullscreen`, `skeletonTheme` neutro (vazio).
2. **`HUB_JWT_SECRET`** pelo Bitwarden (tipo `segredo-hub`).
3. **Endpoint novo `GET /api/hub/org?module={moduleId}`**, com a mesma autenticação de
   `/api/hub/members` (JWT de serviço, `iss` = `module`, 401/404 iguais), usando `readOrgUnits()`
   + `buildPeople()`. Resposta (200, `Cache-Control: no-store`):

   ```json
   { "generatedAt": "ISO",
     "units":  [{ "id": "u1", "name": "Equipe X", "type": "equipe", "parentId": "a1", "leaderEmail": "lider@venetomfo.com.br", "order": 1 }],
     "people": [{ "email": "ana@venetomfo.com.br", "name": "Ana", "position": "Analista", "unitId": "u1", "extraUnitIds": [], "managerEmail": "lider@venetomfo.com.br", "managerMatch": "structure" }] }
   ```

   Regras: excluir `hubHidden`; incluir **todos** os colaboradores (o módulo é `accessMode: all`);
   `leaderEmail` = e-mail de quem tem `idVeneto === unit.leaderIdVeneto` (null se oculto/inexistente);
   `managerEmail` = gestor já resolvido por `buildPeople` (exceção → estrutura → legado);
   `extraUnitIds` só com ids existentes; e-mails em minúsculas. Documentar no protocolo §10.

   O `sistema-rh` já consome exatamente esse formato (com uma fixture local enquanto o endpoint não
   existe); mudanças de shape precisam ser combinadas.

## Critérios de aceite

- Módulo `portal-rh` cadastrado desativado; com `portal-rh:view` liberado para o Victor, o handshake
  completa pelo hub real no Chrome e no Safari do iPhone.
- `HUB_JWT_SECRET` entregue pelo Bitwarden.
- `GET /api/hub/org?module=portal-rh` com JWT de serviço do `portal-rh` responde no formato acima;
  401 sem token ou com `iss` ≠ `module`; 404 para módulo não cadastrado; testes no padrão de
  `src/app/api/hub/__tests__`.
- Depois do teste, módulo ativado e posicionado no menu.

## Resposta do dono

_(preenchido por quem processa: o que foi feito, rollback, links para changelog)_
