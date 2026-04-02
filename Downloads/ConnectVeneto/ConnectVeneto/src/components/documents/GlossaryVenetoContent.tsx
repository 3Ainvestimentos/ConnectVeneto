function TermTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="font-headline text-lg font-bold text-[#e1ca5f]">{children}</h2>;
}

export default function GlossaryVenetoContent() {
  return (
    <article className="max-w-3xl space-y-10 font-body text-foreground">
      <section className="space-y-2">
        <TermTitle>NB</TermTitle>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Identificação individual de cada cliente dentro dos sistemas internos da Vêneto. É usado para cruzamento
          de informações entre diferentes bases (CRM, relatórios de gestão e compliance), garantindo
          rastreabilidade, precisão e confidencialidade dos dados.
        </p>
      </section>

      <section className="space-y-3">
        <TermTitle>Hunter/Farmer/Full Broker</TermTitle>
        <p className="text-sm text-muted-foreground">Segmentações de atuação do time comercial.</p>
        <ul className="list-disc space-y-4 pl-5 text-sm leading-relaxed text-muted-foreground">
          <li>
            <span className="font-semibold text-foreground">Hunter:</span> focado exclusivamente na prospecção e
            captação de novos clientes.
            <br />
            <span className="text-foreground/90">Exemplo:</span> um hunter participa de eventos e realiza ligações
            para apresentar a Vêneto a potenciais clientes.
          </li>
          <li>
            <span className="font-semibold text-foreground">Farmer:</span> atua na manutenção e no desenvolvimento do
            relacionamento com a base de clientes já existente.
            <br />
            <span className="text-foreground/90">Exemplo:</span> um farmer acompanha a carteira de clientes,
            entendendo novas demandas e identificando oportunidades de crescimento de patrimônio.
          </li>
          <li>
            <span className="font-semibold text-foreground">Full Broker:</span> faz tanto a prospecção quanto o
            relacionamento com a base.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <TermTitle>Finder</TermTitle>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Profissional que indica ou apresenta um potencial cliente para o Family Office, mas não conduz o
          relacionamento.
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          <span className="font-semibold text-foreground">Exemplo:</span> um advogado que apresenta um cliente com
          perfil aderente pode atuar como finder.
        </p>
      </section>

      <section className="space-y-2">
        <TermTitle>Prospect</TermTitle>
        <p className="text-sm leading-relaxed text-muted-foreground">Potencial cliente.</p>
      </section>

      <section className="space-y-3">
        <TermTitle>R1, R2 e R3</TermTitle>
        <p className="text-sm text-muted-foreground">Nomenclaturas para as reuniões com clientes.</p>
        <ul className="list-disc space-y-4 pl-5 text-sm leading-relaxed text-muted-foreground">
          <li>
            <span className="font-semibold text-foreground">R1:</span> primeira reunião com o prospect, onde é feita a
            apresentação da empresa e a coleta de informações iniciais do cliente, além da identificação da demanda
            principal.
          </li>
          <li>
            <span className="font-semibold text-foreground">R2:</span> reunião de fechamento da venda, em que são
            apresentados o diagnóstico da carteira e a proposta comercial.
          </li>
          <li>
            <span className="font-semibold text-foreground">R3:</span> reunião de report mensal com o cliente, em que
            são abordados o cenário macro e as movimentações na carteira.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <TermTitle>Diagnóstico da carteira</TermTitle>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Análise da carteira atual de um prospect, comparando-a com uma proposta otimizada sob nossa gestão, para
          evidenciar ganhos, diversificação e alinhamento com seu perfil. É uma apresentação em PowerPoint utilizada
          na R2 e é uma ferramenta para o fechamento da venda.
        </p>
      </section>

      <section className="space-y-2">
        <TermTitle>Background Check</TermTitle>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Verificação prévia da reputação, antecedentes e situação financeira de uma pessoa ou empresa antes de
          iniciar um relacionamento.
        </p>
      </section>

      <section className="space-y-2">
        <TermTitle>KYC (Know Your Client)</TermTitle>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Processo de coleta e verificação de informações para conhecer o cliente, garantindo conformidade com normas
          regulatórias e prevenção à lavagem de dinheiro. Todos os clientes da Vêneto são aprovados pelo nosso
          Compliance antes da abertura oficial da conta.
        </p>
      </section>

      <section className="space-y-2">
        <TermTitle>KYP</TermTitle>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Processo de coleta e verificação de informações para conhecer o parceiro e/ou fornecedor de algum
          serviço/produto.
        </p>
      </section>

      <section className="space-y-2">
        <TermTitle>KYE</TermTitle>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Processo de coleta e verificação de informações para conhecer o colaborador.
        </p>
      </section>

      <section className="space-y-2">
        <TermTitle>NDA</TermTitle>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Acordo de confidencialidade entre as partes para proteger informações sigilosas trocadas durante a
          negociação ou prestação de serviços. Pode ser utilizado em diferentes ocasiões, como para o ingresso de
          novos colaboradores, compartilhamento de dados de clientes, oportunidades de negócios, etc.
        </p>
      </section>

      <section className="space-y-2">
        <TermTitle>Fee Based</TermTitle>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Modelo de remuneração em que o profissional ou a empresa é pago por uma taxa (fee) fixa ou percentual, e não
          por comissão de produtos.
        </p>
      </section>

      <section className="space-y-2">
        <TermTitle>PL</TermTitle>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Sigla para Patrimônio Líquido. Quando dizemos PL sob gestão, é o valor financeiro que está sob a nossa
          gestão.
        </p>
      </section>

      <section className="space-y-2">
        <TermTitle>Rebate</TermTitle>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Retorno financeiro concedido sobre taxas pagas ou investimentos realizados, geralmente como forma de
          incentivo comercial.
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          <span className="font-semibold text-foreground">Exemplo:</span> parte da taxa de administração de um
          produto pode ser devolvida ao cliente como cashback.
        </p>
      </section>

      <section className="space-y-2">
        <TermTitle>Net New Money</TermTitle>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Valor líquido de novos recursos captados, descontadas as retiradas.
        </p>
      </section>
    </article>
  );
}
