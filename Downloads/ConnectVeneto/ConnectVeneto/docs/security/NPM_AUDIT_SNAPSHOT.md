# npm audit report

> **Atualizado:** pos execucao de `npm audit fix` (sem --force).
>
> Resultado: 39 -> 21 advisories. Fechados: todos os criticals e todos os high
> corrigíveis sem breaking change (incluindo `protobufjs`, `node-forge`, `path-to-regexp`,
> `picomatch`, `qs`, `yaml`, `@hono/node-server`, `@modelcontextprotocol/sdk`).
>
> **Residuais ativos (todos low, exceto 1 high):**
> - `xlsx` (high) - residual formal aceito. Ver `XLSX_RISK_REMOVAL_PLAN.md`.
> - 20 advisories low sao em deps transitivas de `genkit-cli` e similares. Fix disponivel
>   exigiria `--force` com breaking change em `firebase-admin`. Nao aplicado.

---


@tootallnate/once  <3.0.1
@tootallnate/once vulnerable to Incorrect Control Flow Scoping - https://github.com/advisories/GHSA-vpq2-c234-7xj6
fix available via `npm audit fix --force`
Will install firebase-admin@10.3.0, which is a breaking change
node_modules/@tootallnate/once
  http-proxy-agent  4.0.1 - 5.0.0
  Depends on vulnerable versions of @tootallnate/once
  node_modules/http-proxy-agent
    teeny-request  7.1.3 - 10.1.0
    Depends on vulnerable versions of http-proxy-agent
    node_modules/teeny-request
      @google-cloud/common  4.0.0 - 5.0.2
      Depends on vulnerable versions of retry-request
      Depends on vulnerable versions of teeny-request
      node_modules/@google-cloud/common
        @google-cloud/logging  >=10.0.4
        Depends on vulnerable versions of @google-cloud/common
        node_modules/@google-cloud/logging
          @google-cloud/logging-winston  >=5.1.2
          Depends on vulnerable versions of @google-cloud/logging
          node_modules/@google-cloud/logging-winston
            @genkit-ai/google-cloud  *
            Depends on vulnerable versions of @google-cloud/logging-winston
            Depends on vulnerable versions of genkit
            node_modules/@genkit-ai/firebase/node_modules/@genkit-ai/google-cloud
              @genkit-ai/firebase  *
              Depends on vulnerable versions of @genkit-ai/google-cloud
              Depends on vulnerable versions of @google-cloud/firestore
              Depends on vulnerable versions of firebase-admin
              Depends on vulnerable versions of genkit
              node_modules/@genkit-ai/firebase
                @genkit-ai/core  >=1.17.0-rc.0
                Depends on vulnerable versions of @genkit-ai/firebase
                node_modules/@genkit-ai/core
                  @genkit-ai/ai  >=1.17.0-rc.0
                  Depends on vulnerable versions of @genkit-ai/core
                  node_modules/@genkit-ai/ai
                  genkit  >=1.17.0-rc.0
                  Depends on vulnerable versions of @genkit-ai/ai
                  Depends on vulnerable versions of @genkit-ai/core
                  node_modules/genkit
                    @genkit-ai/googleai  >=1.17.0-rc.0
                    Depends on vulnerable versions of genkit
                    node_modules/@genkit-ai/googleai
                    @genkit-ai/next  1.8.0-rc.0 - 1.8.0-rc.2 || >=1.17.0-rc.0
                    Depends on vulnerable versions of genkit
                    node_modules/@genkit-ai/next
      @google-cloud/storage  >=5.19.0
      Depends on vulnerable versions of retry-request
      Depends on vulnerable versions of teeny-request
      node_modules/@google-cloud/storage
        firebase-admin  >=11.0.0
        Depends on vulnerable versions of @google-cloud/firestore
        Depends on vulnerable versions of @google-cloud/storage
        node_modules/firebase-admin
      retry-request  7.0.0 - 7.0.2
      Depends on vulnerable versions of teeny-request
      node_modules/retry-request
        google-gax  4.0.5-experimental - 4.6.1
        Depends on vulnerable versions of retry-request
        node_modules/google-gax
          @google-cloud/firestore  7.5.0-pre.0 || 7.6.0 - 7.11.6
          Depends on vulnerable versions of google-gax
          node_modules/@google-cloud/firestore
            @genkit-ai/telemetry-server  >=0.9.0-dev.1
            Depends on vulnerable versions of @google-cloud/firestore
            node_modules/@genkit-ai/telemetry-server
              genkit-cli  >=0.9.0-dev.1
              Depends on vulnerable versions of @genkit-ai/telemetry-server
              node_modules/genkit-cli

xlsx  *
Severity: high
Prototype Pollution in sheetJS - https://github.com/advisories/GHSA-4r6h-8v6p-xvw6
SheetJS Regular Expression Denial of Service (ReDoS) - https://github.com/advisories/GHSA-5pgg-2g8v-p4x9
No fix available
node_modules/xlsx

21 vulnerabilities (20 low, 1 high)

To address issues that do not require attention, run:
  npm audit fix

To address all issues possible (including breaking changes), run:
  npm audit fix --force

Some issues need review, and may require choosing
a different dependency.
