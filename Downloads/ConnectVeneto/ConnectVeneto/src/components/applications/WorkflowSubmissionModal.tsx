
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { format, formatISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarIcon, Loader2, Paperclip } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import type { DateRange } from 'react-day-picker';
import { useWorkflows } from '@/contexts/WorkflowsContext';
import { useAuth } from '@/contexts/AuthContext';
import { getCollaboratorUserId, useCollaborators } from '@/contexts/CollaboratorsContext';
import { WorkflowDefinition } from '@/contexts/ApplicationsContext';
import { uploadFile } from '@/lib/firestore-service';
import { useWorkflowAreas } from '@/contexts/WorkflowAreasContext';
import { findCollaboratorByEmail } from '@/lib/email-utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type DynamicFormValue = string | Date | DateRange | File | null | undefined;
type DynamicFormData = Record<string, DynamicFormValue>;
type WorkflowField = WorkflowDefinition['fields'][number];

const isDateRangeValue = (value: unknown): value is DateRange => {
  if (!value || typeof value !== 'object') return false;
  const maybeRange = value as { from?: unknown; to?: unknown };
  const fromOk = maybeRange.from === undefined || maybeRange.from instanceof Date;
  const toOk = maybeRange.to === undefined || maybeRange.to instanceof Date;
  return fromOk && toOk;
};

interface WorkflowSubmissionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflowDefinition: WorkflowDefinition;
}

export default function WorkflowSubmissionModal({ open, onOpenChange, workflowDefinition }: WorkflowSubmissionModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fileFields, setFileFields] = useState<{[key: string]: File | null}>({});
  const { addRequest, updateRequestAndNotify } = useWorkflows();
  const { user } = useAuth();
  const { collaborators } = useCollaborators();
  const { workflowAreas } = useWorkflowAreas();

  const { control, handleSubmit, reset, formState: { errors } } = useForm<DynamicFormData>();

  const workflowArea = useMemo(() => {
    return workflowAreas.find(area => area.id === workflowDefinition.areaId);
  }, [workflowDefinition, workflowAreas]);

  // Função para obter um ID único para cada campo (usando índice)
  // Isso garante que cada campo seja independente, mesmo que tenham o mesmo field.id
  const getUniqueFieldId = (index: number) => `__field_${index}`;

  useEffect(() => {
    if (open) {
      const defaultValues: DynamicFormData = {};
      workflowDefinition.fields.forEach((field, index) => {
        const uniqueId = getUniqueFieldId(index);
        if (field.type === 'date-range') {
          defaultValues[uniqueId] = { from: undefined, to: undefined };
        } else if (field.type === 'date') {
          defaultValues[uniqueId] = undefined;
        } else {
          defaultValues[uniqueId] = '';
        }
      });
      reset(defaultValues);
      setFileFields({});
    }
  }, [open, workflowDefinition, reset]);


  const handleFileChange = (fieldId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFileFields(prev => ({...prev, [fieldId]: e.target.files![0]}));
    }
  };

  const onSubmit = async (data: DynamicFormData) => {
    const currentUserCollab = findCollaboratorByEmail(collaborators, user?.email);

    if (!user || !currentUserCollab) {
      toast({ title: "Erro de Autenticação", description: "Não foi possível identificar o colaborador.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);

    try {
        // Validação defensiva: garante que há pelo menos um status
        if (!workflowDefinition.statuses || workflowDefinition.statuses.length === 0) {
            throw new Error(`O workflow "${workflowDefinition.name}" não possui status configurados. Entre em contato com o administrador.`);
        }
        
        const now = new Date();
        const initialStatus = workflowDefinition.statuses[0].id;
        
        const submitterUserId = getCollaboratorUserId(currentUserCollab);
        if (!submitterUserId) {
          throw new Error('Não foi possível identificar o ID Veneto do colaborador atual.');
        }

        const initialRequestPayload = {
            type: workflowDefinition.name,
            status: initialStatus,
            ownerEmail: workflowDefinition.ownerEmail,
            submittedBy: { userId: submitterUserId, userName: currentUserCollab.name, userEmail: currentUserCollab.email },
            submittedAt: formatISO(now),
            lastUpdatedAt: formatISO(now),
            formData: {}, 
            history: [{ timestamp: formatISO(now), status: initialStatus, userId: submitterUserId, userName: currentUserCollab.name, notes: 'Solicitação criada.' }],
        };

        const newRequest = await addRequest(initialRequestPayload);

        const storagePath = workflowArea?.storageFolderPath;
        if (!storagePath) {
          throw new Error(`A área de workflow para "${workflowDefinition.name}" não tem uma pasta de armazenamento configurada.`);
        }

        // Mapeia os dados do formulário de volta para usar os IDs originais dos campos
        const formDataForFirestore: DynamicFormData = {};
        const fieldIdUsage = new Map<string, number>(); // Rastreia quantas vezes cada field.id é usado
        
        workflowDefinition.fields.forEach((field, index) => {
          // CORREÇÃO: Pular campos do tipo 'file' no mapeamento inicial
          // Eles serão processados separadamente no bloco de upload (linhas 141-158)
          if (field.type === 'file') {
            return; // Sai da iteração atual e vai para o próximo campo
          }
          
          const uniqueId = getUniqueFieldId(index);
          const value = data[uniqueId];
          
          // Mapeia o valor único de volta para o ID original do campo
          if (value !== undefined && value !== null && value !== '') {
            // Detecta IDs duplicados
            const usageCount = fieldIdUsage.get(field.id) || 0;
            fieldIdUsage.set(field.id, usageCount + 1);
            
            if (usageCount > 0) {
              console.warn(`Aviso: O campo "${field.label}" (índice ${index}) tem o mesmo ID que outro campo ("${field.id}"). Apenas o último valor será salvo. Considere corrigir a definição do workflow para usar IDs únicos.`);
            }
            
            formDataForFirestore[field.id] = value;
          }
        });

        // Processa uploads com timeout e tratamento de erro que não perde dados
        const fileUploadPromises = workflowDefinition.fields
            .map(async (field, originalIndex) => {
              const uniqueId = getUniqueFieldId(originalIndex);
              
              // Verifica se é campo de arquivo E se há arquivo selecionado
              if (field.type !== 'file' || !fileFields[uniqueId]) {
                return null; // Pula campos que não são arquivo ou não têm arquivo selecionado
              }
              
              const file = fileFields[uniqueId];
              if (file) {
                try {
                  // Adiciona timeout de 30 segundos para evitar travamento infinito
                  const uploadPromise = uploadFile(file, storagePath, newRequest.id);
                  const timeoutPromise = new Promise<string>((_, reject) => {
                    setTimeout(() => reject(new Error('TIMEOUT')), 30000);
                  });
                  
                  const url = await Promise.race([uploadPromise, timeoutPromise]);
                  
                  // CORREÇÃO: Validar que a URL é uma string válida antes de salvar
                  if (url && typeof url === 'string' && url.trim() !== '') {
                    formDataForFirestore[field.id] = url;
                    return { fieldId: field.id, success: true };
                  } else {
                    // Se a URL for inválida, marca como erro mas não bloqueia
                    console.warn(`Upload concluído mas URL inválida para o campo "${field.label}"`);
                    formDataForFirestore[field.id] = `ERRO_UPLOAD: URL inválida para ${file.name}`;
                    return { fieldId: field.id, success: false, error: 'URL inválida' };
                  }
                } catch (error) {
                  console.error(`Erro ao fazer upload do arquivo para o campo ${field.label}:`, error);
                  // CORREÇÃO: Não bloqueia o salvamento - marca o campo como erro mas salva os outros dados
                  const errorMessage = error instanceof Error && error.message === 'TIMEOUT' 
                    ? `TIMEOUT: Upload do arquivo "${file.name}" excedeu 30 segundos`
                    : `ERRO: Falha ao fazer upload do arquivo "${file.name}"`;
                  
                  formDataForFirestore[field.id] = `ERRO_UPLOAD: ${errorMessage}`;
                  return { fieldId: field.id, success: false, error: errorMessage };
                }
              }
              return null;
            })
            .filter(promise => promise !== null); // Remove nulls
        
        // Aguarda todos os uploads (sucesso ou erro) sem bloquear
        const uploadResults = await Promise.allSettled(fileUploadPromises);
        
        // Verifica se algum upload falhou para adicionar nota no histórico
        const failedUploads: Array<{ fieldId: string; success: boolean; error?: string }> = [];
        uploadResults.forEach((result) => {
          if (result.status === 'fulfilled' && result.value !== null && !result.value.success) {
            failedUploads.push(result.value);
          }
        });
        
        if (failedUploads.length > 0) {
          const failedFields = failedUploads.map(f => f.fieldId).join(', ');
          console.warn(`Alguns uploads falharam: ${failedFields}`);
        }

        // Processa campos de data com validação
        workflowDefinition.fields.forEach(field => {
            if (field.type === 'date-range' && formDataForFirestore[field.id]) {
                const dateRange = formDataForFirestore[field.id];
                if (isDateRangeValue(dateRange)) {
                  try {
                    const fromDate = dateRange.from;
                    const toDate = dateRange.to;
                    const normalizedRange: Record<string, string | null> = {
                      from: (fromDate && isValid(fromDate)) ? formatISO(fromDate, { representation: 'date' }) : null,
                      to: (toDate && isValid(toDate)) ? formatISO(toDate, { representation: 'date' }) : null,
                    };

                    formDataForFirestore[field.id] = normalizedRange as unknown as DynamicFormValue;
                  } catch (error) {
                    console.warn(`Erro ao processar período de datas no campo ${field.id}:`, error);
                    // Mantém o valor original se houver erro na conversão
                  }
                }
            } else if (field.type === 'date' && formDataForFirestore[field.id]) {
                try {
                    const rawDate = formDataForFirestore[field.id];
                    if (!(rawDate instanceof Date) && typeof rawDate !== 'string') {
                      delete formDataForFirestore[field.id];
                      return;
                    }
                    const dateValue = new Date(rawDate);
                    if (isValid(dateValue)) {
                        formDataForFirestore[field.id] = formatISO(dateValue, { representation: 'date' });
                    } else {
                        console.warn(`Data inválida no campo ${field.id}:`, formDataForFirestore[field.id]);
                        delete formDataForFirestore[field.id]; // Remove campo inválido
                    }
                } catch (error) {
                    console.warn(`Erro ao processar data no campo ${field.id}:`, error);
                    delete formDataForFirestore[field.id]; // Remove campo inválido em caso de erro
                }
            }
        });

        // Adiciona nota no histórico se houver uploads falhados
        if (failedUploads.length > 0) {
          formDataForFirestore._uploadErrors = failedUploads.map(f => f.error).join('; ');
        }

        // Verificar se formDataForFirestore está vazio antes de salvar
        if (Object.keys(formDataForFirestore).length === 0) {
          throw new Error('Nenhum dado foi preenchido no formulário. Por favor, verifique os campos e tente novamente.');
        }

        await updateRequestAndNotify({
            id: newRequest.id,
            formData: formDataForFirestore
        });

        // Mensagem diferente se houver uploads falhados
        if (failedUploads.length > 0) {
          toast({ 
            title: "Solicitação Enviada com Avisos", 
            description: `Seu pedido foi enviado, mas ${failedUploads.length} arquivo(s) não puderam ser enviados. Os dados do formulário foram salvos. Você pode tentar anexar os arquivos novamente editando a solicitação.`,
            variant: "default"
          });
        } else {
          toast({ title: "Solicitação Enviada!", description: `Seu pedido de '${workflowDefinition.name}' foi enviado para aprovação.` });
        }
        onOpenChange(false);

    } catch (error) {
      console.error("Failed to submit workflow request:", error);
      toast({ 
        title: "Erro na Solicitação", 
        description: error instanceof Error ? error.message : "Houve um erro na sua solicitação. Por favor, contate o time de TI.", 
        variant: "destructive" 
      });
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderField = (field: WorkflowField, index: number) => {
    const uniqueFieldId = getUniqueFieldId(index);
    const error = errors[uniqueFieldId];
    const htmlId = `${field.id}_${index}`; // ID único para o elemento HTML
    
    switch (field.type) {
      case 'file':
        return (
          <div key={`${field.id}-${index}`} className="space-y-2">
            <Label htmlFor={htmlId}>{field.label}{field.required && ' *'}</Label>
            <div className="relative">
                <Controller
                  name={uniqueFieldId}
                  control={control}
                  rules={{ required: field.required && !fileFields[uniqueFieldId] ? 'Este anexo é obrigatório.' : false }}
                  render={({ field: { onChange, onBlur, name, ref } }) => (
                     <Input 
                      id={htmlId} 
                      type="file" 
                      name={name}
                      ref={ref}
                      onBlur={onBlur}
                      onChange={(e) => {
                        handleFileChange(uniqueFieldId, e);
                        onChange(e.target.files?.[0]);
                      }} 
                      className="pl-10" 
                      disabled={isSubmitting}
                     />
                  )}
                />
                <Paperclip className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
            {fileFields[uniqueFieldId] && <p className="text-xs text-muted-foreground">Arquivo selecionado: {fileFields[uniqueFieldId]?.name}</p>}
            {error && <p className="text-sm text-destructive">{error.message?.toString()}</p>}
          </div>
        );
      case 'text':
        return (
          <div key={`${field.id}-${index}`} className="space-y-2">
            <Label htmlFor={htmlId}>{field.label}{field.required && ' *'}</Label>
            <Controller 
              name={uniqueFieldId} 
              control={control} 
              rules={{ required: field.required ? "Este campo é obrigatório" : false }} 
              render={({ field: controllerField }) => (
                <Input
                  id={htmlId}
                  value={typeof controllerField.value === 'string' ? controllerField.value : ''}
                  onChange={controllerField.onChange}
                  onBlur={controllerField.onBlur}
                  name={controllerField.name}
                  ref={controllerField.ref}
                  placeholder={field.placeholder}
                  disabled={isSubmitting}
                />
              )} 
            />
            {error && <p className="text-sm text-destructive">{error.message?.toString()}</p>}
          </div>
        );
      case 'textarea':
        return (
          <div key={`${field.id}-${index}`} className="space-y-2">
            <Label htmlFor={htmlId}>{field.label}{field.required && ' *'}</Label>
            <Controller 
              name={uniqueFieldId} 
              control={control} 
              rules={{ required: field.required ? "Este campo é obrigatório" : false }} 
              render={({ field: controllerField }) => (
                <Textarea
                  id={htmlId}
                  value={typeof controllerField.value === 'string' ? controllerField.value : ''}
                  onChange={controllerField.onChange}
                  onBlur={controllerField.onBlur}
                  name={controllerField.name}
                  ref={controllerField.ref}
                  placeholder={field.placeholder}
                  disabled={isSubmitting}
                />
              )} 
            />
            {error && <p className="text-sm text-destructive">{error.message?.toString()}</p>}
          </div>
        );
      case 'select':
        return (
          <div key={`${field.id}-${index}`} className="space-y-2">
            <Label htmlFor={htmlId}>{field.label}{field.required && ' *'}</Label>
            <Controller
              name={uniqueFieldId}
              control={control}
              rules={{ required: field.required ? "Este campo é obrigatório" : false }}
              render={({ field: controllerField }) => (
                <Select
                  onValueChange={controllerField.onChange}
                  value={typeof controllerField.value === 'string' ? controllerField.value : undefined}
                  disabled={isSubmitting}
                >
                  <SelectTrigger id={htmlId}><SelectValue placeholder={field.placeholder || 'Selecione...'} /></SelectTrigger>
                  <SelectContent>
                    {(Array.isArray(field.options) ? field.options : []).map(option => (
                      <SelectItem key={option} value={option}>{option}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {error && <p className="text-sm text-destructive">{error.message?.toString()}</p>}
          </div>
        );
      case 'date':
        return (
          <div key={`${field.id}-${index}`} className="space-y-2">
            <Label htmlFor={htmlId}>{field.label}{field.required && ' *'}</Label>
            <Controller
              name={uniqueFieldId}
              control={control}
              rules={{ required: field.required ? "Selecione uma data." : false }}
              render={({ field: { onChange, value } }) => (
                (() => {
                  const selectedDate = value instanceof Date ? value : undefined;
                  return (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn("w-full justify-start text-left font-normal", !selectedDate && "text-muted-foreground")}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDate ? format(selectedDate, "dd 'de' LLLL 'de' yyyy", { locale: ptBR }) : <span>Selecione uma data</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={selectedDate} onSelect={onChange} initialFocus />
                  </PopoverContent>
                </Popover>
                  );
                })()
              )}
            />
            {error && <p className="text-sm text-destructive">{error.message?.toString()}</p>}
          </div>
        );
      case 'date-range':
        return (
           <div key={`${field.id}-${index}`} className="space-y-2">
            <Label htmlFor={htmlId}>{field.label}{field.required && ' *'}</Label>
            <Controller
              name={uniqueFieldId}
              control={control}
              rules={{ 
                required: field.required ? "Este campo é obrigatório" : false,
                validate: (value) => {
                  if (!field.required) return true;
                  if (!isDateRangeValue(value)) return "Selecione a data de início e fim.";
                  return (!!value.from && !!value.to) || "Selecione a data de início e fim.";
                }
              }}
              render={({ field: controllerField }) => (
                (() => {
                  const selectedRange = isDateRangeValue(controllerField.value) ? controllerField.value : undefined;
                  const from = selectedRange?.from;
                  const to = selectedRange?.to;
                  return (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id={htmlId}
                      variant={'outline'}
                      className={cn('w-full justify-start text-left font-normal', !from && 'text-muted-foreground')}
                      disabled={isSubmitting}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {from ? (
                        to ? (
                          <>{format(from, 'LLL dd, y', { locale: ptBR })} a {format(to, 'LLL dd, y', { locale: ptBR })}</>
                        ) : (
                          format(from, 'LLL dd, y', { locale: ptBR })
                        )
                      ) : (
                        <span>{field.placeholder || 'Escolha um período'}</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      initialFocus
                      mode="range"
                      defaultMonth={from}
                      selected={selectedRange}
                      onSelect={controllerField.onChange}
                      numberOfMonths={2}
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
                  );
                })()
              )}
            />
            {error && <p className="text-sm text-destructive">{error.message?.toString()}</p>}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl font-body flex flex-col h-auto max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl">{workflowDefinition.name}</DialogTitle>
           <DialogDescription asChild>
                <div className="prose prose-sm dark:prose-invert">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {workflowDefinition.description}
                    </ReactMarkdown>
                </div>
            </DialogDescription>
        </DialogHeader>
        <div className="flex-grow overflow-y-auto -mx-6 px-6">
            <div className="space-y-4">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  {workflowDefinition.fields.map((field, index) => renderField(field, index))}
              </form>
            </div>
        </div>
         <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isSubmitting} className="hover:bg-muted">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="button" disabled={isSubmitting} onClick={handleSubmit(onSubmit)} className="bg-admin-primary hover:bg-admin-primary/90">
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Enviar Solicitação
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
