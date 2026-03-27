
"use client";

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { usePolls } from '@/contexts/PollsContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileDown, PieChart as PieChartIcon, CheckSquare, MessageSquare } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import Papa from 'papaparse';
import { format } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF', '#FF19AF'];

export default function PollResultsPage() {
  const router = useRouter();
  const params = useParams();
  const pollId = params.pollId as string;
  const { polls, pollResponses, loadingResponses, loadingPolls } = usePolls();

  const poll = React.useMemo(() => polls.find(p => p.id === pollId), [polls, pollId]);
  const responses = React.useMemo(() => pollResponses[pollId] || [], [pollResponses, pollId]);

  const { resultsData, otherResponses } = React.useMemo(() => {
    if (!poll || responses.length === 0) return { resultsData: [], otherResponses: [] };
    
    if (poll.type === 'multiple-choice') {
        const counts: { [key: string]: number } = {};
        const tempOtherResponses: typeof responses = [];
        
        poll.options.forEach(option => {
            counts[option] = 0;
        });

        responses.forEach(response => {
            if (counts[response.answer] !== undefined) {
                counts[response.answer]++;
            } else {
                tempOtherResponses.push(response);
            }
        });
        
        const finalResultsData = Object.entries(counts).map(([name, value]) => ({ name, value }));

        return { resultsData: finalResultsData, otherResponses: tempOtherResponses };
    }

    return { resultsData: [], otherResponses: [] };
  }, [poll, responses]);

  const totalResponses = responses.length;

  const handleExportCSV = () => {
    if (!poll) return;
    const csvData = responses.map(r => ({
      'ID do Colaborador': r.userId,
      'Nome do Colaborador': r.userName,
      'Resposta': r.answer,
      'Data da Resposta': format(new Date(r.answeredAt), 'dd/MM/yyyy HH:mm:ss'),
    }));
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `respostas_pesquisa_${poll.question.substring(0, 20)}_${poll.id}.csv`;
    link.click();
  };

  if (loadingPolls || loadingResponses) {
    return (
      <div className="space-y-6 p-6 md:p-8">
        <Skeleton className="h-8 w-1/4" />
        <Skeleton className="h-6 w-1/2" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!poll) {
    return (
      <div className="space-y-6 p-6 md:p-8">
        <PageHeader title="Pesquisa não encontrada" />
        <p>A pesquisa que você está tentando visualizar não existe ou foi removida.</p>
        <Button onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
      </div>
    );
  }
  
  const isMultipleChoice = poll.type === 'multiple-choice';

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div className="flex justify-between items-start">
        <div>
          <PageHeader title="Resultados da Pesquisa" />
          <h2 className="text-xl font-semibold text-muted-foreground -mt-4">{poll.question}</h2>
        </div>
        <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.back()}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
            </Button>
            <Button onClick={handleExportCSV} disabled={totalResponses === 0} className="bg-admin-primary hover:bg-admin-primary/90">
                <FileDown className="mr-2 h-4 w-4" />
                Exportar CSV
            </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Respostas</CardTitle>
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalResponses}</div>
            <p className="text-xs text-muted-foreground">respostas coletadas até o momento.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isMultipleChoice ? <PieChartIcon className="h-5 w-5"/> : <MessageSquare className="h-5 w-5"/>}
            {isMultipleChoice ? 'Distribuição das Respostas' : 'Respostas Abertas'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {totalResponses > 0 ? (
            isMultipleChoice ? (
              <ResponsiveContainer width="100%" height={400}>
                <PieChart>
                  <Pie data={resultsData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={120} label>
                    {resultsData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
                <ScrollArea className="h-[400px]">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Colaborador</TableHead>
                                <TableHead>Resposta</TableHead>
                                <TableHead className="text-right">Data</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {responses.map(r => (
                                <TableRow key={r.id}>
                                    <TableCell className="font-medium">{r.userName}</TableCell>
                                    <TableCell className="whitespace-pre-wrap">{r.answer}</TableCell>
                                    <TableCell className="text-right text-xs text-muted-foreground">{format(new Date(r.answeredAt), 'dd/MM/yy HH:mm')}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </ScrollArea>
            )
          ) : (
            <div className="text-center py-10 text-muted-foreground">
                <PieChartIcon className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <p className="mt-4">Ainda não há respostas para esta pesquisa.</p>
            </div>
          )}
        </CardContent>
      </Card>
       {otherResponses.length > 0 && (
         <>
            <Separator />
            <Card>
                <CardHeader>
                    <CardTitle>Respostas &quot;Outros&quot;</CardTitle>
                    <CardDescription>Respostas personalizadas enviadas através da opção &quot;Outros&quot;.</CardDescription>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="h-[200px]">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Colaborador</TableHead>
                                    <TableHead>Resposta</TableHead>
                                    <TableHead className="text-right">Data</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {otherResponses.map(r => (
                                    <TableRow key={r.id}>
                                        <TableCell className="font-medium">{r.userName}</TableCell>
                                        <TableCell className="whitespace-pre-wrap">{r.answer}</TableCell>
                                        <TableCell className="text-right text-xs text-muted-foreground">{format(new Date(r.answeredAt), 'dd/MM/yy HH:mm')}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </CardContent>
            </Card>
         </>
       )}
    </div>
  );
}
