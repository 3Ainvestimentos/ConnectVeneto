
"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { Bar, BarChart as BarChartComponent, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { useApplications } from '@/contexts/ApplicationsContext';
import { useWorkflows } from '@/contexts/WorkflowsContext';
import { useMemo } from 'react';
import { Timer, Hourglass, ListChecks, Workflow as WorkflowIcon } from 'lucide-react';
import { differenceInBusinessDays, parseISO, compareAsc, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { useAudit } from '@/contexts/AuditContext';
import { ScrollArea } from '@/shared/components/ui/scroll-area';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF', '#FF19AF'];

export default function WorkflowAnalyticsPage() {
  const { workflowDefinitions } = useApplications();
  const { requests: allRequests, loading: loadingRequests } = useWorkflows();
  const { dateRange } = useAudit();

  const filteredRequests = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return [];
    
    const from = startOfDay(dateRange.from);
    const to = endOfDay(dateRange.to);

    return allRequests.filter(req => {
      const eventDate = parseISO(req.submittedAt);
      return isWithinInterval(eventDate, { start: from, end: to });
    });
  }, [allRequests, dateRange]);


  const requestsByStatus = useMemo(() => {
    if (loadingRequests || !workflowDefinitions.length) return [];
    
    const statusCounts = {
        'Em aberto': 0,
        'Em processamento': 0,
        'Finalizado': 0,
    };

    filteredRequests.forEach(req => {
        const definition = workflowDefinitions.find(d => d.name === req.type);
        if (!definition || !definition.statuses || definition.statuses.length === 0) {
            statusCounts['Em processamento']++;
            return;
        }

        const initialStatusId = definition.statuses[0].id;
        const finalStatusLabels = ['aprovado', 'reprovado', 'concluído', 'finalizado', 'cancelado'];
        const currentStatusDef = definition.statuses.find(s => s.id === req.status);
        
        if (req.status === initialStatusId && req.history.length <= 1) {
            statusCounts['Em aberto']++;
        } else if (currentStatusDef && currentStatusDef.label && typeof currentStatusDef.label === 'string' && finalStatusLabels.some(label => currentStatusDef.label.toLowerCase().includes(label))) {
            statusCounts['Finalizado']++;
        } else {
            statusCounts['Em processamento']++;
        }
    });

    return Object.entries(statusCounts).map(([name, value]) => ({ name, value }));
  }, [filteredRequests, loadingRequests, workflowDefinitions]);


  const requestsByType = useMemo(() => {
     if (loadingRequests) return [];
      const typeCounts: { [key: string]: number } = {};
      filteredRequests.forEach(req => {
          typeCounts[req.type] = (typeCounts[req.type] || 0) + 1;
      });
      return Object.entries(typeCounts).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);
  }, [filteredRequests, loadingRequests]);

  const averageResolutionTime = useMemo(() => {
    if (loadingRequests || !workflowDefinitions.length) return [];
    
    const resolutionTimes: { [type: string]: { totalDays: number, count: number, totalSlaDays: number } } = {};

    filteredRequests.forEach(req => {
      const definition = workflowDefinitions.find(d => d.name === req.type);
      if (!definition) return;

      const finalStatusLabels = ['aprovado', 'reprovado', 'concluído', 'finalizado', 'cancelado'];
      const currentStatusDef = definition.statuses.find(s => s.id === req.status);
      
      if (currentStatusDef && currentStatusDef.label && typeof currentStatusDef.label === 'string' && finalStatusLabels.some(label => currentStatusDef.label.toLowerCase().includes(label))) {
          const submissionDate = parseISO(req.submittedAt);
          const completionDate = parseISO(req.lastUpdatedAt);
          const businessDays = differenceInBusinessDays(completionDate, submissionDate);
          
          if (!resolutionTimes[req.type]) {
            resolutionTimes[req.type] = { totalDays: 0, count: 0, totalSlaDays: 0 };
          }
          resolutionTimes[req.type].totalDays += businessDays;
          resolutionTimes[req.type].count++;
          
          let slaDays = definition.defaultSlaDays || 0;
          if (definition.slaRules) {
            for (const rule of definition.slaRules) {
                if (req.formData[rule.field] === rule.value) {
                    slaDays = rule.days;
                    break;
                }
            }
          }
          resolutionTimes[req.type].totalSlaDays += slaDays;
      }
    });

    return Object.entries(resolutionTimes)
        .map(([name, data]) => {
            const avgDays = data.count > 0 ? parseFloat((data.totalDays / data.count).toFixed(2)) : 0;
            const avgSla = data.count > 0 ? parseFloat((data.totalSlaDays / data.count).toFixed(2)) : 0;
            return {
                name,
                'Tempo Médio (dias)': avgDays,
                'SLA Definido': avgSla,
            };
        })
        .filter(item => (item['Tempo Médio (dias)'] || 0) > 0)
        .sort((a, b) => b['Tempo Médio (dias)'] - a['Tempo Médio (dias)']);

  }, [filteredRequests, loadingRequests, workflowDefinitions]);
  
 const averageTimePerStatus = useMemo(() => {
    if (loadingRequests || !workflowDefinitions.length) return [];

    const timePerType: { [typeName: string]: { 'Em aberto': number[], 'Em processamento': number[] } } = {};

    filteredRequests.forEach(req => {
      const definition = workflowDefinitions.find(d => d.name === req.type);
      if (!definition || !definition.statuses?.length) return;
      if (!timePerType[req.type]) {
        timePerType[req.type] = { 'Em aberto': [], 'Em processamento': [] };
      }

      const history = [...req.history].sort((a, b) => compareAsc(parseISO(a.timestamp), parseISO(b.timestamp)));

      for (let i = 0; i < history.length; i++) {
        const currentLog = history[i];
        const nextLog = history[i + 1];

        const statusDef = definition.statuses.find(s => s.id === currentLog.status);
        if (!statusDef) continue;
        
        const finalStatusLabels = ['aprovado', 'reprovado', 'concluído', 'finalizado', 'cancelado'];
        if (statusDef.label && typeof statusDef.label === 'string' && finalStatusLabels.some(label => statusDef.label.toLowerCase().includes(label))) {
           break;
        }

        const startDate = parseISO(currentLog.timestamp);
        const endDate = nextLog ? parseISO(nextLog.timestamp) : new Date(); 
        const businessDays = differenceInBusinessDays(endDate, startDate);

        if (businessDays < 0) continue;

        if (i === 0) {
          timePerType[req.type]['Em aberto'].push(businessDays);
        } else {
          timePerType[req.type]['Em processamento'].push(businessDays);
        }
      }
    });

    return Object.entries(timePerType).map(([typeName, statusTimes]) => {
      const avgTimes: Record<string, number | string> = { name: typeName };
      let totalTime = 0;
      const categories = ['Em aberto', 'Em processamento'] as const;

      categories.forEach(statusName => {
        const times = statusTimes[statusName];
         if (times.length > 0) {
          const total = times.reduce((acc, curr) => acc + curr, 0);
          const avg = parseFloat((total / times.length).toFixed(2));
          avgTimes[statusName] = avg;
          totalTime += avg;
        } else {
          avgTimes[statusName] = 0;
        }
      });
      avgTimes.totalTime = totalTime;
      return avgTimes;
    })
    .sort((a, b) => Number(b.totalTime) - Number(a.totalTime));

  }, [filteredRequests, loadingRequests, workflowDefinitions]);


  const resolutionChartHeight = Math.max(350, (averageResolutionTime.length || 0) * 40);
  const timePerStatusChartHeight = Math.max(250, (averageTimePerStatus.length || 0) * 40);


  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="lg:col-span-1">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><ListChecks className="h-5 w-5"/>Tabela Sintética de Solicitações</CardTitle>
                    <CardDescription>Volume total de solicitações enviadas para cada workflow.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Tipo de Workflow</TableHead>
                                    <TableHead className="text-right">Total de Solicitações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {requestsByType.map((item) => (
                                    <TableRow key={item.name}>
                                        <TableCell className="font-medium flex items-center gap-2">
                                            <WorkflowIcon className="h-4 w-4 text-muted-foreground" />
                                            {item.name}
                                        </TableCell>
                                        <TableCell className="text-right font-mono font-bold">{item.value}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
        
        <div className="lg:col-span-1 space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Solicitações por Status</CardTitle>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                            <Pie data={requestsByStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} fill="#8884d8" label>
                                {requestsByStatus.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{ 
                                    backgroundColor: "hsl(var(--background))",
                                    borderColor: "hsl(var(--border))",
                                    borderRadius: "var(--radius)",
                                }}
                            />
                            <Legend wrapperStyle={{fontSize: "14px"}}/>
                        </PieChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

             <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Hourglass className="h-5 w-5" />
                        Tempo Médio por Etapa (Dias Úteis)
                    </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height={timePerStatusChartHeight}>
                        <BarChartComponent data={averageTimePerStatus} layout="vertical" margin={{ left: 10 }}>
                            <XAxis type="number" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} unit="d" />
                            <YAxis dataKey="name" type="category" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} width={250} />
                            <Tooltip
                                contentStyle={{ 
                                    backgroundColor: "hsl(var(--background))",
                                    borderColor: "hsl(var(--border))",
                                    borderRadius: "var(--radius)",
                                }}
                                    cursor={{fill: 'hsl(var(--muted))'}}
                                    formatter={(value: number) => `${value.toFixed(2)} dias`}
                            />
                             <Legend payload={Object.keys(averageTimePerStatus[0] || {}).filter(k => k !== 'name' && k !== 'totalTime' && k !== 'Finalizado').map((key, index) => ({ value: key, type: 'rect', color: COLORS[index % COLORS.length] }))} />
                            {Object.keys(averageTimePerStatus[0] || {}).filter(k => k !== 'name' && k !== 'totalTime' && k !== 'Finalizado').map((key, index) => (
                                <Bar key={key} dataKey={key} stackId="a" fill={COLORS[index % COLORS.length]} />
                            ))}
                        </BarChartComponent>
                    </ResponsiveContainer>
                  </ScrollArea>
                </CardContent>
            </Card>

             <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Timer className="h-5 w-5" />
                        Tempo Médio de Resolução (Dias Úteis)
                    </CardTitle>
                    <CardDescription>A barra fica vermelha se o tempo médio excede o SLA definido.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[350px] w-full">
                    <ResponsiveContainer width="100%" height={resolutionChartHeight}>
                        <BarChartComponent data={averageResolutionTime} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                            <YAxis 
                                dataKey="name" 
                                type="category" 
                                stroke="#888888" 
                                fontSize={12} 
                                tickLine={false} 
                                axisLine={false}
                                width={300}
                            />
                            <XAxis type="number" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} unit="d"/>
                            <Tooltip
                                contentStyle={{ 
                                    backgroundColor: "hsl(var(--background))",
                                    borderColor: "hsl(var(--border))",
                                    borderRadius: "var(--radius)",
                                }}
                                cursor={{fill: 'hsl(var(--muted))'}}
                                formatter={(value: number, name: string) => [`${value} dias`, name === 'Tempo Médio (dias)' ? 'Tempo Médio' : 'SLA Definido']}
                            />
                           <Legend payload={[
                                { value: 'Dentro do SLA', type: 'rect', color: 'hsl(var(--admin-primary))' },
                                { value: 'Fora do SLA', type: 'rect', color: 'hsl(var(--destructive))' },
                                { value: 'SLA Definido', type: 'rect', color: 'hsl(var(--muted-foreground))' },
                            ]}/>
                            <Bar dataKey="Tempo Médio (dias)" radius={[0, 4, 4, 0]}>
                                {averageResolutionTime.map((entry, index) => {
                                    const isOverSla = entry['Tempo Médio (dias)'] > entry['SLA Definido'];
                                    return <Cell key={`cell-${index}`} fill={isOverSla ? 'hsl(var(--destructive))' : 'hsl(var(--admin-primary))'} />;
                                })}
                            </Bar>
                             <Bar dataKey="SLA Definido" fill="hsl(var(--muted-foreground))" radius={[0, 4, 4, 0]} />
                        </BarChartComponent>
                    </ResponsiveContainer>
                  </ScrollArea>
                </CardContent>
            </Card>
        </div>
    </div>
  );
}
