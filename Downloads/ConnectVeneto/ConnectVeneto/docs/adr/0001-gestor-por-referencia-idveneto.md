# Gestor por referência (idVeneto), não por nome

Hoje `collaborators.leader` guarda o nome do gestor em texto livre, o que quebra com homônimos e mudanças de nome e impede montar o Organograma e o "reporta a / lidera" do Perfil. Decidimos migrar para uma referência ao `idVeneto` do Gestor, casando automaticamente pelo nome atual e deixando os casos ambíguos para revisão do RH. Escolhemos a árvore de pessoas em vez de um organograma só por Eixo/Área, aceitando o custo da migração.
