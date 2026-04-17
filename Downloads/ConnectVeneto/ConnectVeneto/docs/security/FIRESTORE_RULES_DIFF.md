# Proposta de diff textual para `firestore.rules`

> **Importante:** nao aplicar automaticamente. A publicacao de regras
> afeta imediatamente todos os clientes. Este documento traz diff sugerido,
> justificativa por bloco, impacto operacional e checklist de publicacao.

> **Status atual:** Bloco 7 Phase B concluido em codigo.
> `SystemSettingsContext.fetchPrivateSystemSettings` nao le mais `config` via SDK.
> Agora pode publicar o diff com seguranca. Nao e mais necessario migrar dados
> para `admin_config` — a mudanca unica e restringir a leitura de `config` a super admin.

Arquivo base: `firestore.rules` na raiz do repositorio.

---

## Sumario das mudancas propostas

1. Restringir `systemSettings/admin_config` e `systemSettings/keys` a `isSuperAdmin()` apenas (hoje estao abertos para qualquer autenticado).
2. Manter `systemSettings/config` com leitura autenticada (por compatibilidade), **apos** o Parcial 7 mover campos sensiveis para `admin_config`.
3. Reforcar `collaborators` com leitura para `isAuthenticated()` mantida, porem documentar a decisao como aceita (Finding F-03).
4. Introduzir validacao estruturada em `leaderTrips` update (hoje update nao valida shape).
5. Manter regra padrao `allow read, write: if false;` no final como fallback.

---

## Diff sugerido (bloco por bloco)

### 1. `systemSettings`

**Atual:**
```js
match /systemSettings/{docId} {
  allow read: if docId == 'public_config';
  allow read: if isAuthenticated() && docId in ['config', 'admin_config', 'keys'];
  allow write: if isSuperAdmin() && docId in ['public_config', 'config', 'admin_config', 'keys'];
}
```

**Proposto:**
```js
match /systemSettings/{docId} {
  // Publico: mensagem de manutencao
  allow read: if docId == 'public_config';

  // Autenticado corporativo: apenas config (minimalizado apos Parcial 7)
  allow read: if isAuthenticated() && docId == 'config';

  // Super admin: le admin_config e keys, escreve em todos
  allow read: if isSuperAdmin() && docId in ['admin_config', 'keys'];
  allow write: if isSuperAdmin() && docId in ['public_config', 'config', 'admin_config', 'keys'];
}
```

**Justificativa:**
- Fecha Finding F-01 (superAdminEmails legivel).
- Mantem compatibilidade basica para `config` enquanto Parcial 7 remove campos sensiveis.
- Requer que a migracao do Parcial 7 ja esteja feita; caso contrario, clientes comuns quebrariam ao tentar ler `admin_config`.

**Pre-condicao para aplicar:**
- Rodar Parcial 7 antes: copiar campos sensiveis de `config` para `admin_config`, adaptar `SystemSettingsContext` e `AuthContext` para nao ler mais desses campos no client.

### 2. `collaborators`

**Atual:**
```js
match /collaborators/{userId} {
  allow read: if isAuthenticated();

  allow create: if isSuperAdmin()
                || isCollaboratorImporter()
                || (
                  isAuthenticated()
                  && request.resource.data.authUid is string
                  && request.resource.data.authUid == request.auth.uid
                );

  allow update: if isSuperAdmin()
                || (
                  isAuthenticated()
                  && (
                    (resource.data.authUid is string && resource.data.authUid == request.auth.uid)
                    || (
                      resource.data.email is string
                      && request.auth.token.email is string
                      && resource.data.email == request.auth.token.email
                    )
                  )
                );

  allow delete: if isSuperAdmin();
}
```

**Proposta:** manter como esta, documentando aceitacao do residual F-03.

**Justificativa:**
- Diversos componentes dependem de listar colaboradores (ex.: sugestao de lider em `ManageTripsBirthdays`, contextos, ProfileModal).
- Restringir sem refactor causaria quebra generalizada.
- Aceitar como residual com monitoramento.

**Acao futura recomendada:**
- Criar endpoint server-side `/api/collaborators` para consumo agregado e, em bloco dedicado, restringir leitura direta a super admin + importadores.

### 3. `leaderTrips`

**Atual:**
```js
match /leaderTrips/{tripId} {
  allow read: if isAuthenticated();

  allow create: if isSuperAdmin()
                || (
                  isCreatorByUid('responsavelUid')
                  && request.resource.data.leaderName is string
                  && request.resource.data.destinationBranch is string
                  && request.resource.data.startDate is string
                  && request.resource.data.endDate is string
                );

  allow update, delete: if isSuperAdmin()
                        || isOwnerByUid('responsavelUid');
}
```

**Proposto:**
```js
match /leaderTrips/{tripId} {
  allow read: if isAuthenticated();

  allow create: if isSuperAdmin()
                || (
                  isCreatorByUid('responsavelUid')
                  && request.resource.data.leaderName is string
                  && request.resource.data.destinationBranch is string
                  && request.resource.data.startDate is string
                  && request.resource.data.endDate is string
                );

  allow update: if isSuperAdmin()
                || (
                  isOwnerByUid('responsavelUid')
                  && request.resource.data.leaderName is string
                  && request.resource.data.destinationBranch is string
                  && request.resource.data.startDate is string
                  && request.resource.data.endDate is string
                );

  allow delete: if isSuperAdmin()
                || isOwnerByUid('responsavelUid');
}
```

**Justificativa:**
- Hoje `update` aceita qualquer shape; duplica validacao do `create`.
- Reduz risco de update com campo malformado que quebre UI.

### 4. Regras MVP abertas (revisao parcial)

**Atual:**
```js
function isMvpOpenCollection(collectionId) {
  return collectionId in [
    'workflowAreas', 'workflowDefinitions', 'workflows',
    'messages', 'fabMessages', 'idleFabMessages', 'polls',
    'meeting_analyses', 'vacation_requests', 'vacation_approvers',
    'birthdays', 'counters'
  ];
}

match /{collectionId}/{docId} {
  allow read, write: if isAuthenticated() && isMvpOpenCollection(collectionId);
}
```

**Proposta:** manter no curto prazo, mas criar PR futuro para restringir **write** em
`workflowAreas`, `workflowDefinitions`, `vacation_approvers` a super admin apenas.

**Justificativa:**
- Definicoes de workflow e approvers nao devem poder ser alteradas por qualquer autenticado.
- Nao mudar agora para evitar regressao sem teste de integracao.

### 5. Regra final de bloqueio

Manter exatamente como esta:

```js
match /{document=**} {
  allow read, write: if false;
}
```

Sem mudancas.

---

## Ordem segura de aplicacao

1. **Parcial 7 antes.** Migrar campos sensiveis para `admin_config` e adaptar o client.
2. Aplicar proposta item 1 (systemSettings restrito).
3. Aplicar proposta item 3 (leaderTrips update validado).
4. Monitorar por 48h.
5. Em bloco futuro, revisar item 4 (MVP collections).

---

## Checklist manual pos-publicacao

Apos `firebase deploy --only firestore:rules`:

- [ ] Login com usuario comum funciona.
- [ ] Login com super admin funciona.
- [ ] `/dashboard` carrega normalmente.
- [ ] `/admin/content` continua acessivel a super admin.
- [ ] Criacao/edicao de viagem de lider funciona pelo dono.
- [ ] Importacao de colaboradores por super admin funciona.
- [ ] `/api/billing` retorna 200 para super admin.
- [ ] Leitura de `systemSettings/admin_config` via SDK client falha para usuario comum (esperado).
- [ ] Sem erro `Missing or insufficient permissions` em fluxos normais.

---

## Plano de rollback

Se algo quebrar:

1. Redeploy da versao anterior de `firestore.rules`:
   - `git checkout <commit-anterior> -- firestore.rules`
   - `firebase deploy --only firestore:rules`
2. Verificar via `firebase firestore:rules get` que publicou.
3. Reabrir este documento e ajustar a proposta.

---

## Status

- Diff proposto, **nao aplicado**.
- Requer Parcial 7 executado antes.
- Requer aprovacao explicita do usuario.
