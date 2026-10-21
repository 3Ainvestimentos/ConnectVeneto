# ConnectVeneto — Comunicação Interna

Hub centralizado de comunicação interna da Vêneto. A Home do Connect mostra o que a pessoa precisa fazer e saber (pendências, Avisos, agenda, pessoas e equipes, indicadores); as Notícias chegam pelo Resumo diário e ficam guardadas na página Publicações, por canal.

## Language

### Publicação

**Canal**:
Espaço temático onde publicações são organizadas (ex.: Tecnologia, Eventos). Tem um dono e uma lista de Publicadores.
_Avoid_: grupo, comunidade, newsletter

**Publicação**:
Conteúdo publicado por um Publicador em um Canal; é uma Notícia ou um Aviso e pode conter um Evento ou uma enquete.
_Avoid_: post, comunicado

**Notícia**:
Publicação Normal: cultura, conquistas, employer branding. Não aparece na Home; chega pelo Resumo diário e fica em Publicações. (As Notícias antigas de `newsItems` são o legado migrado para cá.)
_Avoid_: post, novidade

**Aviso**:
Publicação Importante dentro do Prazo do aviso: um recado com data (prazo de entrega, evento). Aparece no widget Avisos da Home enquanto vale.
_Avoid_: alerta, comunicado, destaque

**Publicador**:
Colaborador autorizado a publicar em um ou mais Canais. A Comunicação publica em todos.
_Avoid_: editor, comunicador, admin de conteúdo

**Dono do canal**:
Colaborador responsável por um Canal e por quem pode publicar nele.
_Avoid_: moderador, admin do canal

**Importância**:
Nível de uma Publicação: Normal (Notícia) ou Importante (Aviso). Na tela de publicar aparece como "Tipo: Notícia | Aviso".
_Avoid_: prioridade, urgência, crítico

**Importante**:
Publicação que, durante o Prazo do aviso, aparece em Avisos na Home e no topo de Publicações, sem exigir confirmação de leitura.

**Prazo do aviso**:
Data, definida pelo Publicador ("válido até"), até a qual uma Publicação Importante é Aviso. "Encerrar aviso" antecipa o fim; a Publicação continua no Canal.
_Avoid_: período de destaque (termo antigo), fixar

**Validade**:
Data a partir da qual uma Publicação deixa de aparecer no Feed.

**Comentário relevante**:
Comentário que o autor da Publicação tornou visível para todos; os demais comentários só o autor vê.
_Avoid_: comentário aprovado, destaque

### Consumo

**Home**:
Página inicial do Connect (piloto em `/inicio`): Avisos (com "Novo aviso" para Publicadores), To-do (tarefas do TrackFlow), Agenda, Pessoas e equipes e Indicadores. Não tem Feed.
_Avoid_: dashboard, painel, mural

**Publicações (página)**:
Página `/publicacoes` com o Feed completo por Canal. É para onde levam o Resumo diário, as notificações e os links de Publicação.

**Feed**:
Fluxo de Publicações da página Publicações. Abre em **Todos** (Canais seguidos + Avisos); escolher um Canal mostra tudo dele.
_Avoid_: mural, timeline

**Resumo diário**:
Pop-up da primeira visita do dia com as Notícias dos Canais seguidos que saíram desde o último Resumo que a pessoa viu. Não abre se não houver nada novo; fechar marca como visto. Também abre sob demanda pelo botão "Resumo" da página Publicações, sem marcar como visto. No piloto, substitui o Daily Fin.
_Avoid_: newsletter, digest, e-mail diário

**Seguir canal**:
Escolha do colaborador de ver no Feed as Publicações de um Canal.
_Avoid_: newsletter, inscrever-se, assinar

### Pessoas

**Perfil**:
Página de um colaborador que reúne Dados oficiais e Dados pessoais.

**Dados oficiais**:
Cargo, área, equipe, eixo, unidade, Gestor, data de nascimento, data de entrada e Histórico de cargos — só o RH altera (cadastro de colaboradores ou planilha "Atualizar perfis").

**Dados pessoais**:
Foto, bio, atribuições, interesses e contatos — só a própria pessoa altera.

**Histórico de cargos**:
Sequência datada dos cargos que um colaborador ocupou na Vêneto.
_Avoid_: carreira, trajetória

**Gestor**:
Colaborador a quem outro colaborador reporta diretamente. Vem da Estrutura: o Responsável da Unidade da pessoa ou, se for ela mesma, o da Unidade de cima (ADR 0004). Exceções ficam marcadas na pessoa; sem Unidade, vale o gestor do cadastro (ADR 0001).
_Avoid_: líder (quando usado como nome em texto livre), chefe

**Estrutura**:
Árvore de Unidades da Vêneto em três níveis: Diretoria › Área › Equipe. Mantida pelo RH em Pessoas › Estrutura.
_Avoid_: hierarquia (para a árvore de pessoas), organização

**Unidade**:
Nó da Estrutura (uma Diretoria, Área ou Equipe), com um Responsável. Cada colaborador pertence a uma Unidade, normalmente uma Equipe.
_Avoid_: departamento, setor (não são níveis da Estrutura)

**Responsável**:
Colaborador que responde por uma Unidade; é o Gestor de quem está nela.

**Área**:
Unidade que reúne Equipes (por exemplo, várias equipes sob a mesma gestora), dentro de uma Diretoria.

**Equipe**:
Unidade mais baixa da Estrutura: grupo de colaboradores sob um Responsável. Um Gestor pode responder por várias Equipes, normalmente reunidas numa Área.
_Avoid_: time, squad, célula

**Organograma**:
Visão das pessoas em /pessoas, de dois jeitos: "Por estrutura" (Diretorias, Áreas e Equipes com Responsável e pessoas) e "Por liderança" (quem reporta a quem, navegável a partir do topo).

### Agenda

**Viagem**:
Registro, feito pelo próprio colaborador e sem aprovação, de que ele estará em outra cidade ou unidade num período, para que os colegas de lá aproveitem a presença.
_Avoid_: ausência, deslocamento

**Férias**:
Período de afastamento solicitado pelo colaborador e aprovado pelo Gestor; só as aprovadas aparecem para os colegas.

**Evento**:
Acontecimento com data e local, interno ou para clientes, divulgado em uma Publicação, com confirmação de presença. Aparece em Agenda e Eventos, na Home, junto com o Google Agenda da Vêneto.
