# Análise Conceitual da Aplicação: 3A RIVA Connect

## 1. Resumo da Aplicação

O **3A RIVA Connect** é uma aplicação de intranet corporativa moderna, projetada para ser o ponto central de comunicação, acesso a recursos e ferramentas para todos os colaboradores da empresa. O sistema foi desenvolvido para um público de aproximadamente 250 usuários ativos, com foco em usabilidade, performance e segurança.

O objetivo principal é substituir canais de comunicação dispersos (e-mails, grupos de mensagens) por uma plataforma unificada, melhorando o engajamento, a produtividade e o acesso à informação.

---

## 2. Usos e Funcionalidades Previstas

A aplicação consolida diversas funcionalidades essenciais para o dia a dia corporativo, abrangendo desde a comunicação interna até a gestão de processos complexos. Abaixo, detalhamos cada componente conforme o diagrama de arquitetura.

### 2.1. Acesso e Painel Principal

-   **Página de Login (`/login`):** Portal de entrada seguro que utiliza o sistema de autenticação do Google, restrito a contas do domínio da empresa.
-   **Painel Inicial (`/dashboard`):** A primeira tela após o login, projetada para ser um hub de informações relevantes e personalizadas.
    -   **Destaques de Notícias:** Apresenta as notícias mais importantes, definidas pelos administradores.
    -   **Mensagens Importantes:** Exibe um feed de comunicados direcionados ao usuário ou a grupos, com controle de leitura.
    -   **Calendário de Eventos:** Mostra os próximos eventos corporativos, como reuniões e feriados.
    -   **Links Rápidos:** Uma seção de botões customizáveis que dão acesso direto a ferramentas externas (ex: Google Drive, sistemas de RH) e links dinâmicos (ex: pasta pessoal de um colaborador).

### 2.2. Seções de Conteúdo e Ferramentas

-   **Feed de Notícias (`/news`):** Uma visão completa de todas as notícias e comunicados da empresa, em ordem cronológica.
-   **Solicitações (`/solicitacoes`):** Antiga aba "Workflows", este é o portal onde os colaboradores iniciam processos digitais.
    -   **Agrupamentos por Área:** Os workflows são organizados em "áreas de negócio" (ex: Financeiro, RH), representadas por botões.
    -   **Lista de Workflows (Modal):** Ao clicar em uma área com múltiplos processos, um modal exibe a lista de workflows disponíveis para seleção.
    -   **Formulário de Submissão (Modal):** Após selecionar um workflow, um formulário dinâmico é apresentado para o preenchimento da solicitação.
    -   **Tabela "Minhas Solicitações":** Uma seção na mesma página que lista todas as solicitações já feitas pelo usuário, permitindo o acompanhamento de status e previsão de conclusão.
-   **Repositório de Documentos (`/documents`):** Biblioteca centralizada para documentos importantes (políticas, manuais, relatórios), com funcionalidades de busca e filtragem por categoria e tipo.
-   **Regras Comerciais (`/regras-comerciais`):** Framework de Reuniões (R1, R1 Offshore, R2 e R3) e Mix de Serviços com política comercial vigente.
-   **Loja 3A RIVA (`/store`):** Integração via `iframe` com a loja da NuvemShop, permitindo acesso direto aos produtos da marca.
-   **Chatbot Bob 1.0 (`/chatbot`):** Um assistente virtual com IA (Inteligência Artificial) integrado, capaz de responder a perguntas, buscar informações em documentos da plataforma e executar tarefas simples como resumir conversas.
-   **Business Intelligence (`/bi`):** Página com acesso restrito que exibe um painel de Power BI embarcado, destinado a análises gerenciais.
-   **Minhas Tarefas (`/me/tasks`):** Uma caixa de entrada unificada para o colaborador, onde são listadas todas as pendências relacionadas a workflows. A página é dividida em:
    -   **Ações Pendentes:** Solicitações onde a **aprovação**, **ciência** ou **execução** do usuário é necessária para que o processo avance.
    -   **Tarefas Atribuídas:** Solicitações que foram atribuídas diretamente ao usuário para processamento e acompanhamento.

### 2.3. Painéis de Controle (Acesso de Admin)

-   **Caixa de Entrada (`/requests`):** Visão de gerenciamento para proprietários de workflows, onde eles podem visualizar, atribuir, arquivar e processar as solicitações pendentes.
-   **Gerenciamento de Conteúdo (`/admin/content`):** Painel central para administrar todo o conteúdo dinâmico da intranet.
    -   **Gerenciar Notícias, Documentos, Mensagens, Links Rápidos e Pesquisas.**
-   **Gerenciamento de Workflows (`/admin/workflows`):** O centro de controle para todos os processos digitais da empresa.
    -   **Aba "Definições":** Permite gerenciar as "Áreas de Workflow" e as "Definições de Workflow" (onde se constrói o formulário, as etapas, as regras de SLA e as notificações de cada processo).
    -   **Aba "Histórico Geral":** Uma tabela completa com todas as solicitações já feitas no sistema, permitindo uma visão global e auditoria de todos os processos.
-   **Administração do Sistema (`/admin/admin` - Super Admin):** Área restrita para a gestão de usuários e segurança.
    -   **Gerenciar Colaboradores:** Ferramenta para adicionar, editar ou remover colaboradores da base de dados.
    -   **Gerenciar Permissões:** Painel para conceder ou revogar permissões de acesso aos diferentes painéis.
    -   **Modo Manutenção:** Ferramenta para suspender o acesso à plataforma durante atualizações.
-   **Painel de Auditoria (`/audit` - Super Admin):** Uma visão centralizada para monitorar a atividade da plataforma.
    -   **Análise de Logins:** Gráficos e métricas sobre a frequência de acesso dos usuários, incluindo os mais e menos engajados.
    -   **Análise de Conteúdos e Páginas:** Relatórios sobre quais notícias, documentos e páginas são mais (e menos) visualizados.
    -   **Análise de Workflows:** Métricas sobre o volume de solicitações, tempo médio de resolução e gargalos nos processos, com status consolidados em "Em Aberto", "Em Processamento" e "Finalizado".

---

## 3. Arquitetura e Tecnologias Utilizadas

A aplicação adota uma arquitetura moderna baseada em JavaScript/TypeScript, utilizando um framework de frontend robusto e serviços de backend gerenciados (Backend-as-a-Service).

### 3.1. Frontend

-   **Framework Principal:** **Next.js (com React)**. A escolha se baseia no uso do **App Router**, que promove renderização no servidor (Server-Side Rendering) e componentes de servidor (React Server Components).
-   **Linguagem:** **TypeScript**. Garante segurança de tipos e manutenibilidade do código.
-   **Componentes de UI e Estilização:**
    -   **ShadCN UI:** Biblioteca de componentes acessíveis e customizáveis.
    -   **Tailwind CSS:** Framework de CSS utility-first para estilização rápida e responsiva.
-   **Gerenciamento de Estado e Dados:**
    -   **React Query (TanStack Query):** Utilizada para fetching, caching e sincronização de dados do Firestore.

### 3.2. Backend e Serviços (Firebase)

-   **Banco de Dados:** **Cloud Firestore**. Banco de dados NoSQL para armazenar todas as informações da aplicação.
-   **Autenticação:** **Firebase Authentication**. Gerencia o login de usuários via provedor do Google.
-   **Armazenamento de Arquivos:** **Firebase Cloud Storage**. Utilizado para hospedar imagens, vídeos e anexos de workflows.
-   **Hospedagem:** **Firebase App Hosting**. Plataforma otimizada para hospedar aplicações Next.js.

### 3.3. Funcionalidades de IA (GenAI)

-   **Framework de IA:** **Genkit (Google)**. Framework open-source que facilita a integração de modelos de linguagem (LLMs).
-   **Modelos de Linguagem:** **Google Gemini**. É o cérebro por trás do chatbot "Bob", responsável por entender perguntas, gerar respostas e executar tarefas como busca na base de conhecimento.

---

## 4. Diagrama de Arquitetura da Informação

Esta é uma visão estruturada das páginas e funcionalidades disponíveis.

```
/ (Raiz)
├── /login (Página de Autenticação)
│
└── / (Área Autenticada)
    ├── /dashboard (Painel Inicial)
    ├── /news (Feed de Notícias)
    ├── /solicitacoes (Portal de início de processos)
    ├── /documents (Repositório de Documentos)
    ├── /regras-comerciais (Framework de Reuniões e Mix de Serviços)
    ├── /area-logada (Área Logada)
    ├── /store (Loja 3A RIVA - Embed)
    ├── /chatbot (Assistente Bob 1.0)
    ├── /bi (Business Intelligence - Acesso Restrito)
    ├── /personal-panel (Painel Pessoal - Acesso Restrito)
    │
    ├── /me/tasks (Minhas Tarefas - Caixa de Entrada Unificada)
    │   ├── Tarefas Atribuídas
    │   └── Ações Pendentes (Aprovações/Cientes/Execuções)
    │
    ├── /requests (Caixa de Entrada - Gerenciamento para Proprietários)
    │
    └── /admin (Painéis de Controle - Acesso de Admin)
        ├── /content (Gerenciamento de Conteúdo)
        ├── /workflows (Gerenciamento de Workflows)
        │
        ├── /admin (Administração do Sistema - Super Admin)
        │   ├── Gerenciar Colaboradores
        │   ├── Gerenciar Permissões
        │   └── Modo Manutenção
        │
        └── /audit (Painel de Auditoria - Super Admin)
            ├── /audit (Análise de Logins)
            ├── /audit/content-interaction (Análise de Conteúdos)
            └── /audit/workflow-analytics (Análise de Workflows)
```
