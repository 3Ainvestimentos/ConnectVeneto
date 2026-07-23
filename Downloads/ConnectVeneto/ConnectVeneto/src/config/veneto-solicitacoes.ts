export type SolicitationItemExternal = {
  kind: "external";
  title: string;
  href: string;
  subtitle?: string;
  description?: string;
  newTab?: boolean;
  trackingKey?: string;
  pillVariant?: "default" | "primary";
};

export type SolicitationItemInfo = {
  kind: "info";
  title: string;
  infoText: string;
  subtitle?: string;
  description?: string;
  trackingKey?: string;
  pillVariant?: "default" | "primary";
};

export type SolicitationItem = SolicitationItemExternal | SolicitationItemInfo;

export type SolicitationArea = {
  id: string;
  title: string;
  icon: string;
  overviewUrl?: string;
  subitemsLayout?: "default" | "pill-grid";
  showSlaImage?: boolean;
  slaImageSrc?: string;
  slaImageAlt?: string;
  slaImageCaption?: string;
  items: SolicitationItem[];
  trackingKey?: string;
};

const CARTILHA_IMPRESSA_INFO = `Para adquirir a versao impressa da cartilha entre em contato com o marketing.

Importante:
Apos registrar sua solicitacao, o marketing entrara em contato para informar o valor da impressao e prazo de entrega.
*O valor e prazo de producao pode variar conforme as especificidades de cada cartilha. Recomendamos que realize seu pedido com pelo menos 10 dias de antecedencia para garantir que a cartilha chegue dentro do prazo necessario.`;

export const venetoSolicitacoesAreas: SolicitationArea[] = [
  {
    id: "legal-compliance",
    title: "Legal e Compliance",
    icon: "Shield",
    trackingKey: "area_legal_compliance",
    items: [
      {
        kind: "external",
        title: "Know Your Client - Pessoas Fisicas",
        href: "https://forms.monday.com/forms/8ea9712c84ae20a6df99059fd17ae977?r=use1",
        trackingKey: "legal_kyc_pf",
      },
      {
        kind: "external",
        title: "Know Your Client - Pessoa Juridica Brasil",
        href: "https://forms.monday.com/forms/8385ab78a6b74921e553c19b2d5a0b2c?r=use1",
        trackingKey: "legal_kyc_pj_br",
      },
      {
        kind: "external",
        title: "Know Your Client - Companhia Offshore",
        href: "https://forms.monday.com/forms/aa7182788903fa1e14c9aabcde1794d3?r=use1",
        trackingKey: "legal_kyc_offshore",
      },
      {
        kind: "external",
        title: "Know Your Client - Cliente de Wealth Planning/Planejamento Financeiro",
        href: "https://forms.monday.com/forms/65e77b3d4ab6a8e721fa723e9a8d70a5?r=use1",
        trackingKey: "legal_kyc_wp",
      },
      {
        kind: "external",
        title: "Atualizacao do processo de Know Your Client (KYC)",
        href: "https://forms.monday.com/forms/f3fdc86e1caed82c7587575f1c5e8e8f?r=use1",
        trackingKey: "legal_kyc_update",
      },
      {
        kind: "external",
        title: "Registro de novos parceiros",
        href: "https://wkf.ms/4qsXeUA",
        trackingKey: "legal_novos_parceiros",
      },
      {
        kind: "external",
        title: "Solicitacao de assinatura de novos documentos",
        href: "https://docs.google.com/forms/d/e/1FAIpQLSdBYwLWFB2TrpgasQJBi0KhXrWSun3so_9bKyNnoG-RV7MJRw/viewform",
        trackingKey: "legal_assinatura_docs",
      },
      {
        kind: "external",
        title: "Reporte de Desenquadramento de Carteira Administrada",
        href: "https://wkf.ms/44i0F73",
        trackingKey: "legal_desenquadramento",
      },
      {
        kind: "external",
        title: "Solicitacao de Investimentos Pessoais",
        href: "https://wkf.ms/4o6Zy1v",
        trackingKey: "legal_investimentos_pessoais",
      },
    ],
  },
  {
    id: "geral",
    title: "Geral",
    icon: "LayoutGrid",
    overviewUrl: "https://venetofamilyoffice.wixsite.com/website/advisory",
    trackingKey: "area_geral",
    items: [
      {
        kind: "external",
        title: "Indicacao de parceiros para a area de Novos Negocios",
        href: "https://docs.google.com/forms/d/e/1FAIpQLSd78AknY72bdTcXkGKV6GiekYaiEwaSzkY5JHe0E3lhIlAyVA/viewform?usp=preview",
        trackingKey: "geral_indicacao_parceiros",
      },
      {
        kind: "external",
        title: "Ferramentas de Wealth Planning",
        href: "https://docs.google.com/forms/d/e/1FAIpQLSc5ss_tBNqXQ7YHMttkEyl7nTauYYLYxlGtumGtbeDbST1Njw/viewform",
        trackingKey: "geral_wealth_planning_forms",
      },
      {
        kind: "external",
        title: "Biblioteca",
        href: "https://docs.google.com/forms/d/e/1FAIpQLSdNnMmx-S1HQ2tMVr1-bN-00qp-ihoYIWElDDJPDUuZt_q4ew/viewform",
        trackingKey: "geral_biblioteca",
      },
    ],
  },
  {
    id: "marketing",
    title: "Marketing",
    icon: "Megaphone",
    overviewUrl: "https://venetofamilyoffice.wixsite.com/website/marketing",
    trackingKey: "area_marketing",
    items: [
      {
        kind: "external",
        title: "Materiais de Marketing",
        href: "https://drive.google.com/drive/folders/15r0fR4ZO0NaPHQwWn6IIOqyHO7ia2tNv?usp=drive_link",
        trackingKey: "mkt_materiais",
      },
      {
        kind: "external",
        title: "Solicitacao de adequacao das cartilhas a identidade visual da Veneto",
        href: "https://forms.gle/iNkTQ4A1Nhm8QJun7",
        trackingKey: "mkt_adequacao_cartilhas",
      },
      {
        kind: "external",
        title: "Veneto Experience",
        href: "https://venetomfo.wixsite.com/venetoexperience",
        trackingKey: "mkt_veneto_experience",
      },
      {
        kind: "external",
        title: "Clube de vantagens Falcons",
        href: "https://venetofamilyoffice.wixsite.com/website/marketing/clube-de-vantagens",
        trackingKey: "mkt_clube_vantagens",
      },
    ],
  },
  {
    id: "inteligencia-comercial",
    title: "Inteligencia Comercial",
    icon: "BarChart",
    showSlaImage: true,
    slaImageSrc: "/solicitacoes/slas-inteligencia-comercial.svg",
    slaImageAlt:
      "Tabela de SLAs da Inteligencia Comercial com prazos para diagnostico, help comercial, solicitacoes gerais, novo cliente, transferencia de custodia, offshore, conta exterior, previdencia, fora do rol e cambio.",
    slaImageCaption:
      "SLAs da Inteligencia Comercial. Para prazo medio por instituicao, consultar a equipe de Inteligencia Comercial.",
    trackingKey: "area_inteligencia_comercial",
    items: [
      {
        kind: "external",
        title: "Solicitacoes gerais ao cadastro",
        href: "https://forms.monday.com/forms/f38d4598603d60c892e401b6ff08a708?r=use1",
        trackingKey: "ic_solicitacoes_gerais",
      },
      {
        kind: "external",
        title: "Solicitacao de diagnostico",
        href: "https://forms.gle/SKy2Viiu4dCvczTRA",
        trackingKey: "ic_diagnostico",
      },
      {
        kind: "external",
        title: "Cadastro de novos clientes",
        href: "https://forms.monday.com/forms/ee0142f13fd1a6e45bf3270275c26e3a?r=use1",
        trackingKey: "ic_novo_cliente",
      },
      {
        kind: "external",
        title: "Solicitacoes de atualizacao de ganho (desde o inicio)",
        href: "https://forms.gle/v6kamw4FoBWLc28z5",
        trackingKey: "ic_atualizacao_ganho",
      },
      {
        kind: "external",
        title: "Cadastro de contas fora do rol de servicos Nacional e Internacional",
        href: "https://forms.monday.com/forms/ca59b30a50b7450202a250182e510c80?r=use1",
        trackingKey: "ic_contas_fora_rol",
      },
      {
        kind: "external",
        title: "Transferencia de custodia",
        href: "https://forms.monday.com/forms/ec12d32689fcdb5d11182d93f8652196?r=use1",
        trackingKey: "ic_transferencia_custodia",
      },
      {
        kind: "external",
        title: "Contratacao e portabilidade - Previdencia",
        href: "https://forms.monday.com/forms/8f023bd83f6d36902183f86e79b628ee?r=use1",
        trackingKey: "ic_previdencia",
      },
      {
        kind: "external",
        title: "Cadastro de Offshore (PJ)",
        subtitle: "Envie o KYC antes deste forms.",
        href: "https://forms.gle/96dWs1JqB6Nyiji47",
        trackingKey: "ic_cadastro_offshore",
      },
      {
        kind: "external",
        title: "Cadastro de PF exterior",
        subtitle: "Envie o KYC antes deste forms.",
        href: "https://forms.monday.com/forms/cc188fc230048495aa14bfcdf78ef7b8?r=use1",
        trackingKey: "ic_cadastro_pf_exterior",
      },
      {
        kind: "external",
        title: "Passo a passo instituicoes - Manuais consultivos",
        href: "https://venetofamilyoffice.wixsite.com/website/menu-v%C3%AAneto",
        trackingKey: "ic_passo_a_passo",
      },
      {
        kind: "external",
        title: "Solicitacoes de fundo exclusivo",
        href: "https://forms.monday.com/forms/fe90616ff4d3a92ea5e29aae55297e90?r=use1",
        trackingKey: "ic_fundo_exclusivo",
      },
      {
        kind: "external",
        title: "Formulario para reserva de leads",
        href: "https://docs.google.com/forms/d/e/1FAIpQLSf_Pk6_ipKo6ZBfciiiZC6KvaFxCjVnctTC1_mS-Kkddt5p7g/viewform?usp=sf_link",
        trackingKey: "ic_reserva_leads",
      },
      {
        kind: "external",
        title: "Manuais de Cadastro - Materiais consultivos",
        href: "https://venetofamilyoffice.wixsite.com/website/manuais-de-cadastro",
        trackingKey: "ic_manuais_cadastro",
      },
    ],
  },
  {
    id: "mesa",
    title: "Mesa",
    icon: "Banknote",
    trackingKey: "area_mesa",
    items: [
      {
        kind: "external",
        title: "Politica geral de investimentos",
        href: "https://docs.google.com/forms/d/e/1FAIpQLSfXTmz8dqovZQTGSyMtKLGBx4tWvrYvOQNWchlnchTf2enVgA/viewform",
        trackingKey: "mesa_politica_geral",
      },
      {
        kind: "external",
        title: "Politica de venda de ativos de credito",
        href: "https://forms.gle/Yax2rJGx8g5efHNYA",
        trackingKey: "mesa_venda_credito",
      },
      {
        kind: "external",
        title: "Politica de investimentos offshore",
        href: "https://docs.google.com/forms/d/e/1FAIpQLSdeuGxGWNjFNDPvYRomGVkJX5MR8zmqKZUOxILwBv1WY_KE0Q/viewform",
        trackingKey: "mesa_offshore",
      },
      {
        kind: "external",
        title: "Solicitacoes gerais",
        href: "https://docs.google.com/forms/d/e/1FAIpQLSdVG17lU1ZdYpW0-geam3VRwqbCpJPMm7CpEGGiUA9uVu40DQ/viewform",
        trackingKey: "mesa_gerais",
      },
      {
        kind: "external",
        title: "Politica de ativos High Yield",
        href: "https://docs.google.com/forms/d/e/1FAIpQLScMMDMBHPx_4THTBV2s1FN8GdZqa_QAvs4g4ItfH9iR_f5FHA/viewform",
        trackingKey: "mesa_high_yield",
      },
      {
        kind: "external",
        title: "Solicitacoes de Acoes/FII",
        href: "https://forms.gle/GrzL7Ffki1P7n9udA",
        trackingKey: "mesa_acoes_fii",
      },
      {
        kind: "external",
        title: "Movimentacoes fundo exclusivo",
        href: "https://docs.google.com/forms/d/e/1FAIpQLSeNzGUeMcCwviv656ABvPHv_k1zf8PePZQ8Rfdwq8JRz-S-WQ/viewform",
        trackingKey: "mesa_mov_fundo_exclusivo",
      },
      {
        kind: "external",
        title: "Fundos aprovados pela gestao",
        href: "https://docs.google.com/spreadsheets/d/1v-cutrNqwB75qx4pPxZ1cOj2z_qah2NWFAF_XGifqtw/edit?gid=2062615399#gid=2062615399",
        trackingKey: "mesa_fundos_aprovados",
      },
      {
        kind: "external",
        title: "Solicitacoes de cambio",
        href: "https://forms.gle/F9AGevt6m49Ha7jt7",
        trackingKey: "mesa_cambio",
      },
      {
        kind: "external",
        title: "Excecao de saldos",
        href: "https://docs.google.com/forms/d/e/1FAIpQLSd9wcNuKYqXOItRF35sJ22ewB3p3ENoAu-hBQgID_wZKLlbnA/viewform",
        trackingKey: "mesa_excecao_saldos",
      },
      {
        kind: "external",
        title: "Politicas de fundos exclusivos",
        href: "https://forms.gle/RKXUF5apn9o6CEyU6",
        trackingKey: "mesa_politica_fundos_exclusivos",
      },
    ],
  },
  {
    id: "financeiro",
    title: "Financeiro",
    icon: "DollarSign",
    overviewUrl: "https://venetofamilyoffice.wixsite.com/website/financeiro-e-rh",
    trackingKey: "area_financeiro",
    items: [
      {
        kind: "external",
        title: "Solicitacoes de Pagamentos",
        href: "https://forms.gle/VzScvJ8N2738rzyC9",
        trackingKey: "fin_pagamentos",
      },
      {
        kind: "external",
        title: "Solicitacoes de Reembolso",
        href: "https://forms.gle/YxjMqmv1dZnQEyqz8",
        trackingKey: "fin_reembolso",
      },
      {
        kind: "external",
        title: "Agendamento de Ferias",
        href: "https://docs.google.com/forms/d/e/1FAIpQLSfl-fVlTQO1FxBwjiZFO_KMPHU6QDG_hI8lEqDfPzTlWLbKlw/viewform",
        trackingKey: "fin_ferias",
      },
      {
        kind: "external",
        title: "Solicitacao de Demandas - Administrativo/Secretaria Executiva",
        href: "https://forms.gle/hVVoaMMXHRyXQ5S49",
        trackingKey: "fin_demanda_admin",
      },
      {
        kind: "external",
        title: "Solicitacao de deliberacao de gastos - Comite Financeiro",
        href: "https://forms.gle/PZRefyBn3f4UpvHB9",
        trackingKey: "fin_deliberacao_gastos",
      },
      {
        kind: "external",
        title: "Formulario de sugestoes e melhorias",
        href: "https://docs.google.com/forms/d/e/1FAIpQLSd4OJhMJ1yF4EUSAycNaNt5eTeY82pCRIV7dyUABwpaMXparQ/viewform",
        trackingKey: "fin_sugestoes",
      },
    ],
  },
  {
    id: "wealth-planning",
    title: "Wealth Planning",
    icon: "Briefcase",
    overviewUrl: "https://venetofamilyoffice.wixsite.com/website/wealth-planning",
    subitemsLayout: "pill-grid",
    trackingKey: "area_wealth",
    items: [
      {
        kind: "external",
        title: "Fundos de Investimentos",
        href: "https://venetofamilyoffice.wixsite.com/website/wealth-planning",
        trackingKey: "wp_fundos_investimento",
      },
      {
        kind: "info",
        title: "Cartilha Impressa",
        infoText: CARTILHA_IMPRESSA_INFO,
        trackingKey: "wp_cartilha_impressa",
        pillVariant: "primary",
      },
    ],
  },
];
