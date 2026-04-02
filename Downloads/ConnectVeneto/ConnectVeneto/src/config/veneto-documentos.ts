import type { DocumentType } from "@/contexts/DocumentsContext";
import { VENETO_REPOSITORY_SORT_SENTINEL_ISO } from "@/lib/document-repository-utils";

export const venetoRepositoryDocuments: DocumentType[] = [
  {
    id: "veneto-apresentacoes",
    name: "Apresentações",
    category: "Materiais Vêneto",
    type: "link",
    size: "—",
    lastModified: VENETO_REPOSITORY_SORT_SENTINEL_ISO,
    downloadUrl:
      "https://drive.google.com/drive/folders/11bHVd0qd9IIwVdwGrGIv_M_4BQNmI266?usp=sharing",
  },
  {
    id: "veneto-book-cultura",
    name: "Book de Cultura",
    category: "Materiais Vêneto",
    type: "pdf",
    size: "—",
    lastModified: VENETO_REPOSITORY_SORT_SENTINEL_ISO,
    downloadUrl:
      "https://drive.google.com/file/d/1ql40CLxX_bt08OFW23E27r9tKMOuT_Ol/view?usp=sharing",
  },
  {
    id: "veneto-timbrados",
    name: "Timbrados",
    category: "Materiais Vêneto",
    type: "link",
    size: "—",
    lastModified: VENETO_REPOSITORY_SORT_SENTINEL_ISO,
    downloadUrl:
      "https://drive.google.com/drive/folders/1PAv8VdCZ5SdbCJiW9wM2c3nKV8bz12AC?usp=sharing",
  },
  {
    id: "veneto-glossario",
    name: "Glossário Vêneto",
    category: "Materiais Vêneto",
    type: "interno",
    size: "—",
    lastModified: VENETO_REPOSITORY_SORT_SENTINEL_ISO,
    downloadUrl: "",
    internalPath: "/documents/glossario",
  },
  {
    id: "veneto-podcasts-rv",
    name: "Podcasts de análise (cases) — Renda Variável",
    category: "Podcasts",
    type: "link",
    size: "—",
    lastModified: VENETO_REPOSITORY_SORT_SENTINEL_ISO,
    downloadUrl: "https://drive.google.com/drive/folders/1AvbOjghVHYsCjrjPeYFWlbjhXk5Kv-EV",
  },
  {
    id: "veneto-podcasts-rf",
    name: "Podcasts de análise (cases) — Renda Fixa",
    category: "Podcasts",
    type: "link",
    size: "—",
    lastModified: VENETO_REPOSITORY_SORT_SENTINEL_ISO,
    downloadUrl:
      "https://drive.google.com/drive/folders/11bKcEr2EHYt_bgHNzhe9w-d8oAhHWaxp?usp=sharing",
  },
  {
    id: "veneto-wealth-planning-forms",
    name: "Ferramentas de Wealth Planning",
    category: "Materiais Vêneto",
    type: "form",
    size: "—",
    lastModified: VENETO_REPOSITORY_SORT_SENTINEL_ISO,
    downloadUrl:
      "https://docs.google.com/forms/d/e/1FAIpQLSc5ss_tBNqXQ7YHMttkEyl7nTauYYLYxlGtumGtbeDbST1Njw/viewform",
  },
  {
    id: "veneto-material-educacional",
    name: "Material educacional",
    category: "Materiais Vêneto",
    type: "link",
    size: "—",
    lastModified: VENETO_REPOSITORY_SORT_SENTINEL_ISO,
    downloadUrl: "https://drive.google.com/drive/folders/1FU_ByuAMu-CXjmM0Qw_NEYTJ8zB7tIsk",
  },
  {
    id: "veneto-estruturacao-dividas",
    name: "Estruturação de dívidas",
    category: "Materiais Vêneto",
    type: "pdf",
    size: "—",
    lastModified: VENETO_REPOSITORY_SORT_SENTINEL_ISO,
    downloadUrl:
      "https://208adb0a-813d-4d6c-818f-187f744fecf9.filesusr.com/ugd/a753c6_cd4b79f3eaa14b40976f09094fbb911e.pdf",
  },
  {
    id: "veneto-biblioteca",
    name: "Biblioteca",
    category: "Materiais Vêneto",
    type: "form",
    size: "—",
    lastModified: VENETO_REPOSITORY_SORT_SENTINEL_ISO,
    downloadUrl:
      "https://docs.google.com/forms/d/e/1FAIpQLSdNnMmx-S1HQ2tMVr1-bN-00qp-ihoYIWElDDJPDUuZt_q4ew/viewform",
  },
];
