# O acesso vem de um perfil, ligado à equipe

Cada pessoa tinha as permissões marcadas uma a uma (21 chaves em `permissions`, mais uma lista por módulo em `modulePermissions`), por super admin, numa tabela de ~28 colunas. Ninguém sabia dizer "o que um comercial acessa", e várias chaves já não protegiam nada. Decidimos que o acesso vem de um **perfil de acesso** (`accessProfiles`): um pacote configurável de permissões e de acessos a módulos. O perfil fica na **unidade da Estrutura** (ADR 0004) e vale para quem está nela; sem perfil na unidade, vale o da unidade de cima, e assim até o topo. A pessoa pode ter um perfil próprio (exceção) e **ajustes** avulsos que ligam ou desligam itens do perfil.

O perfil **não substitui** as checagens que já existem: o servidor calcula o acesso efetivo (perfil + ajustes) e grava em `permissions` e `modulePermissions`, que as páginas, as APIs e os tokens dos módulos continuam lendo. Quem não tem perfil (nem pela unidade, nem próprio) fica como estava. Isso deixa a troca sem risco e reversível: na migração, o ajuste de cada pessoa é a diferença entre o acesso que ela já tinha e o do perfil, então ninguém ganha nem perde nada no dia.

Quem mexe: o RH (admin do cadastro) e os super admins atribuem perfis às unidades e às pessoas e fazem ajustes; criar e editar o que um perfil libera é só de super admin. Permissões do grupo Sistema (painel do sistema, auditoria) só um super admin concede, por perfil ou ajuste. Tudo passa por API com Admin SDK e fica em `collaborator_logs`.

Rejeitamos perfis fixos no código (cada mudança viraria deploy) e trocar as checagens para lerem o perfil direto (mexeria em todas as páginas e APIs de uma vez, sem como voltar).
