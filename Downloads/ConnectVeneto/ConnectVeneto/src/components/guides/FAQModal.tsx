"use client";

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from '@/components/ui/button';
import { HelpCircle, FileText } from 'lucide-react';
import { useSystemSettings } from '@/contexts/SystemSettingsContext';


interface FAQModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const faqItems = [
  {
    question: "Como faço para acessar a plataforma?",
    answer:
      "O login na Intranet Veneto é feito com sua conta Google corporativa da Veneto (@venetomfo.com.br). Na página inicial, clique em 'Entrar com Google' e use suas credenciais.",
  },
  {
    question: "Onde eu inicio uma solicitação (reembolso, férias, etc.)?",
    answer:
      "Vá para 'Solicitações' no menu lateral. Há um card para cada área: Legal e Compliance, Geral, Marketing, Inteligência Comercial, Mesa, Financeiro, Wealth Planning e TI/Suporte. Clique no card desejado para abrir formulários, documentos e materiais daquele tema. Em Inteligência Comercial você também encontra a tabela de SLAs para consulta. O acompanhamento de cada pedido fica no canal correspondente (e-mail, Monday, Google Forms etc.) ou com a equipe responsável — esta página apenas direciona aos links.",
  },
  {
    question: "Como acompanho minhas solicitações e tarefas?",
    answer:
      "Para pedidos feitos pelos links desta intranet, o acompanhamento costuma ser pelo próprio canal de envio (confirmação por e-mail, Monday, Google Forms) ou diretamente com a área responsável. Se você usa fluxos internos de aprovação na plataforma, tarefas pendentes podem aparecer em 'Minhas Tarefas/Ações', pelo menu do seu avatar.",
  },
  {
    question: "O que é a Consulta Pessoal?",
    answer:
      "A Consulta Pessoal reúne os links para as principais planilhas pessoais dos colaboradores. Quando houver mais de um tipo (por exemplo MESA, CLIENTE ou CX), use as abas no topo da página para alternar entre elas.",
  },
  {
    question: "Onde estão os documentos da instituição?",
    answer:
      "Os documentos ficam no Repositório de Documentos: use o item 'Documentos' no menu lateral para abrir essa página. Lá há materiais fixos da Vêneto e demais documentos cadastrados; use a pesquisa e os filtros por categoria e tipo para localizar o que precisa.",
  },
  {
    question: "O que encontro na seção 'Regras Comerciais'?",
    answer:
      "A seção 'Regras Comerciais' reúne o Framework de Reuniões (R1, R1 Offshore, R2 e R3) e a apresentação de Mix de Serviços da Vêneto, incluindo a política comercial vigente.",
  },
  {
    question: "Como posso visualizar meu perfil e alterar o tema?",
    answer:
      "Clique no seu avatar no canto superior direito para abrir o menu. Selecione 'Meu Perfil' para ver suas informações. No mesmo menu, use a opção 'Tema' para alternar entre os modos claro e escuro.",
  },
];

export default function FAQModal({ open, onOpenChange }: FAQModalProps) {
  const { settings } = useSystemSettings();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg font-body">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <HelpCircle className="h-7 w-7 text-muted-foreground" />
            <DialogTitle className="font-headline text-2xl">Guias e FAQ</DialogTitle>
          </div>
          <DialogDescription className="text-sm">
            Encontre respostas para perguntas frequentes e guias de utilização da Intranet Veneto
          </DialogDescription>
        </DialogHeader>
        <div className="py-2 max-h-[60vh] overflow-y-auto pr-4">
          <Accordion type="single" collapsible className="w-full">
            {faqItems.map((item, index) => (
              <AccordionItem value={`item-${index + 1}`} key={index}>
                <AccordionTrigger className="text-left font-body text-sm font-semibold">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="font-body text-muted-foreground">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
             <AccordionItem value="terms">
                <AccordionTrigger className="text-left font-body text-sm font-semibold">Onde encontro os documentos legais?</AccordionTrigger>
                <AccordionContent className="space-y-2">
                    <p className="font-body text-muted-foreground">
                      Você pode acessar os documentos legais da plataforma clicando nos links abaixo.
                    </p>
                    <div className="flex flex-col items-start gap-2">
                        {settings.termsUrl && (
                             <Button variant="link" asChild className="p-0 h-auto text-foreground hover:underline">
                                <a href={`https://docs.google.com/gview?url=${encodeURIComponent(settings.termsUrl)}&embedded=true`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">
                                    <FileText className="h-4 w-4" />Termos de Uso
                                </a>
                            </Button>
                        )}
                        {settings.privacyPolicyUrl && (
                             <Button variant="link" asChild className="p-0 h-auto text-foreground hover:underline">
                                <a href={`https://docs.google.com/gview?url=${encodeURIComponent(settings.privacyPolicyUrl)}&embedded=true`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">
                                    <FileText className="h-4 w-4" />Política de Privacidade
                                </a>
                            </Button>
                        )}
                    </div>
                </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} variant="outline" className="hover:bg-muted">Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
