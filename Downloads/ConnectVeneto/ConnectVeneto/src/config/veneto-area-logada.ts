export type AreaLogadaCard = {
  id: string;
  title: string;
  href: string;
  manualLabel?: string;
  manualHref?: string;
};

export const venetoAreaLogadaCards: AreaLogadaCard[] = [
  {
    id: "relatorio-virtual",
    title: "Relatório Virtual",
    href: "https://app.appsmith.com/app/portal-do-cliente/login-6631380bd4c17c152778c131?branch=release%252Fpaliativo-versao1",
  },
  {
    id: "terminal-consulta",
    title: "Terminal de consulta",
    href: "https://app.appsmith.com/app/terminal-de-consulta/login-67b4d6221ef521411d30b1b7",
  },
  {
    id: "area-cliente",
    title: "Área do Cliente",
    href: "http://app.venetomfo.com.br/",
    manualLabel: "Manual de Acesso",
    manualHref:
      "https://208adb0a-813d-4d6c-818f-187f744fecf9.filesusr.com/ugd/a753c6_cfe1c31d38554faf968cf0b697d7d62b.pdf",
  },
];
