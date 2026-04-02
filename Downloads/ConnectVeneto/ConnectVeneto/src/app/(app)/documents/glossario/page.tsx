import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import GlossaryVenetoContent from "@/components/documents/GlossaryVenetoContent";

export default function GlossarioVenetoPage() {
  return (
    <div className="space-y-8 p-6 md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Glossário Vêneto"
          description="Termos e definições usados no dia a dia comercial e institucional."
        />
        <Button variant="outline" asChild className="shrink-0 font-body">
          <Link href="/documents">Voltar para Documentos</Link>
        </Button>
      </div>
      <GlossaryVenetoContent />
    </div>
  );
}
