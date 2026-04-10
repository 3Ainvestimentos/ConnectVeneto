
import { PageHeader } from "@/components/layout/PageHeader";

export default function PersonalPanelPage() {
  return (
    <div className="flex flex-col h-full space-y-6 p-6 md:p-8">
      <div>
        <PageHeader 
           title="Consulta Pessoal" 
           description="Acesse suas planilhas de consulta."
        />
      </div>
      <div className="flex-1 min-h-0 w-full relative">
        <iframe
          src="https://ted-cyan.vercel.app/"
          className="w-full h-full border-none absolute inset-0 rounded-lg"
          title="Diretoria"
          allow="microphone"
        ></iframe>
      </div>
    </div>
  );
}
