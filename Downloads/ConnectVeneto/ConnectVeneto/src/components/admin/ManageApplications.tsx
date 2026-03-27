"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";

export function ManageApplications() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Gerenciar Aplicações</CardTitle>
        <CardDescription>
          A gestão de aplicações foi consolidada em Definições de Workflow.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Utilize a seção de workflows para criar e manter os itens exibidos no hub de aplicações.
        </p>
      </CardContent>
    </Card>
  );
}

