
"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useSystemSettings } from '@/contexts/SystemSettingsContext';
import { toast } from '@/hooks/use-toast';
import { Loader2, Construction, Users, FileText, UserCheck, Shield, Trash2, PlusCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RecipientSelectionModal } from './RecipientSelectionModal';
import { useCollaborators } from '@/contexts/CollaboratorsContext';
import { Input } from '../ui/input';
import { LoadingSpinner } from '../ui/loading-spinner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

const maintenanceSchema = z.object({
  maintenanceMode: z.boolean(),
  maintenanceMessage: z.string().min(10, 'A mensagem de manutenção deve ter pelo menos 10 caracteres.'),
  allowedUserIds: z.array(z.string()).optional(),
});
type MaintenanceFormValues = z.infer<typeof maintenanceSchema>;

const termsSchema = z.object({
  termsUrl: z.string().url("Por favor, insira uma URL válida.").or(z.literal('')),
});
type TermsFormValues = z.infer<typeof termsSchema>;

const privacySchema = z.object({
  privacyPolicyUrl: z.string().url("Por favor, insira uma URL válida.").or(z.literal('')),
});
type PrivacyFormValues = z.infer<typeof privacySchema>;


// Função para normalizar emails (mesma lógica do AuthContext)
const normalizeEmail = (email: string | null | undefined): string | null => {
    if (!email) return null;
    return email.trim().toLowerCase();
};

function SuperAdminsCard() {
  const { settings, loading, updateSystemSettings } = useSystemSettings();
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddAdmin = async () => {
    const emailToAdd = newAdminEmail.trim().toLowerCase();
    if (!emailToAdd) return;
    if (!z.string().email().safeParse(emailToAdd).success) {
      toast({ title: 'E-mail inválido', variant: 'destructive' });
      return;
    }
    // Normaliza o email antes de verificar e adicionar
    const normalizedEmailToAdd = normalizeEmail(emailToAdd) || emailToAdd;
    const normalizedExistingEmails = settings.superAdminEmails.map(email => normalizeEmail(email)).filter((email): email is string => email !== null);
    if (normalizedExistingEmails.includes(normalizedEmailToAdd) || settings.superAdminEmails.includes(emailToAdd)) {
      toast({ title: 'Administrador já existe', variant: 'destructive' });
      return;
    }
    
    setIsSubmitting(true);
    try {
      // Salva o email normalizado para manter consistência
      await updateSystemSettings({ superAdminEmails: [...settings.superAdminEmails, normalizedEmailToAdd] });
      toast({ title: 'Sucesso', description: `${normalizedEmailToAdd} foi adicionado como Super Admin.` });
      setNewAdminEmail('');
    } catch {
      toast({ title: 'Erro', description: 'Não foi possível adicionar o Super Admin.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleRemoveAdmin = async (emailToRemove: string) => {
    if (settings.superAdminEmails.length <= 1) {
      toast({ title: 'Ação não permitida', description: 'Deve haver pelo menos um Super Admin.', variant: 'destructive' });
      return;
    }
    
    setIsSubmitting(true);
    try {
        await updateSystemSettings({ superAdminEmails: settings.superAdminEmails.filter(email => email !== emailToRemove) });
        toast({ title: 'Sucesso', description: `${emailToRemove} foi removido.` });
    } catch {
        toast({ title: 'Erro', description: 'Não foi possível remover o Super Admin.', variant: 'destructive' });
    } finally {
        setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Shield className="h-6 w-6"/> Gerenciar Super Admins</CardTitle>
        <CardDescription>Adicione ou remova e-mails com permissão total de acesso ao sistema.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
            <Label>E-mails com acesso Super Admin</Label>
            {loading ? (
                <div className="flex justify-center py-2">
                  <LoadingSpinner className="h-5 w-5" />
                </div>
            ) : (
                <div className="space-y-2">
                    {settings.superAdminEmails.map(email => (
                        <div key={email} className="flex items-center justify-between p-2 border rounded-md bg-background">
                            <span className="text-sm font-mono">{email}</span>
                            <Button variant="ghost" size="icon" onClick={() => handleRemoveAdmin(email)} disabled={isSubmitting}>
                                <Trash2 className="h-4 w-4 text-destructive"/>
                            </Button>
                        </div>
                    ))}
                </div>
            )}
        </div>
         <div className="flex gap-2">
            <Input 
                type="email" 
                placeholder="novo.admin@venetomfo.com.br"
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                disabled={isSubmitting}
            />
            <Button onClick={handleAddAdmin} disabled={isSubmitting || !newAdminEmail} className="bg-admin-primary hover:bg-admin-primary/90">
                 {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                Adicionar
            </Button>
        </div>
      </CardContent>
    </Card>
  )
}

/** Quem pode criar colaboradores em lote (importação CSV) — regra Firestore `isCollaboratorImporter`. Super Admins já têm permissão. */
function CollaboratorImporterAdminsCard() {
  const { settings, loading, updateSystemSettings } = useSystemSettings();
  const [newEmail, setNewEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const importerList = settings.collaboratorAdminEmails ?? [];

  const handleAdd = async () => {
    const emailToAdd = normalizeEmail(newEmail.trim());
    if (!emailToAdd) return;
    if (!z.string().email().safeParse(emailToAdd).success) {
      toast({ title: 'E-mail inválido', variant: 'destructive' });
      return;
    }
    const normalizedExisting = importerList.map((e) => normalizeEmail(e)).filter((e): e is string => e !== null);
    if (normalizedExisting.includes(emailToAdd)) {
      toast({ title: 'E-mail já está na lista', variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);
    try {
      await updateSystemSettings({ collaboratorAdminEmails: [...importerList, emailToAdd] });
      toast({ title: 'Sucesso', description: `${emailToAdd} pode importar colaboradores em lote. Faça deploy das regras do Firestore se ainda não aplicou.` });
      setNewEmail('');
    } catch {
      toast({ title: 'Erro', description: 'Não foi possível salvar.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemove = async (emailToRemove: string) => {
    setIsSubmitting(true);
    try {
      await updateSystemSettings({
        collaboratorAdminEmails: importerList.filter((e) => e !== emailToRemove),
      });
      toast({ title: 'Removido', description: emailToRemove });
    } catch {
      toast({ title: 'Erro', description: 'Não foi possível remover.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-6 w-6" />
          Importação de colaboradores (RH)
        </CardTitle>
        <CardDescription>
          E-mails aqui podem usar &quot;Importar&quot; na tela de colaboradores (criação em lote no Firestore). Super Admins não precisam estar nesta lista.
          Após alterar, publique as regras: <span className="font-mono text-xs">firebase deploy --only firestore:rules</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>E-mails autorizados na importação em lote</Label>
          {loading ? (
            <div className="flex justify-center py-2">
              <LoadingSpinner className="h-5 w-5" />
            </div>
          ) : importerList.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum — apenas Super Admins podem importar até você adicionar e-mails.</p>
          ) : (
            <div className="space-y-2">
              {importerList.map((email) => (
                <div key={email} className="flex items-center justify-between p-2 border rounded-md bg-background">
                  <span className="text-sm font-mono">{email}</span>
                  <Button variant="ghost" size="icon" onClick={() => handleRemove(email)} disabled={isSubmitting}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder="rh@venetomfo.com.br"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            disabled={isSubmitting}
          />
          <Button onClick={handleAdd} disabled={isSubmitting || !newEmail} className="bg-admin-primary hover:bg-admin-primary/90 shrink-0">
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
            Adicionar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}


function MaintenanceCard() {
  const { settings, loading, updateSystemSettings } = useSystemSettings();
  const [isSelectionModalOpen, setIsSelectionModalOpen] = useState(false);
  const [isUpdatingSwitch, setIsUpdatingSwitch] = useState(false);

  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting: isFormSubmitting } } = useForm<MaintenanceFormValues>({
    resolver: zodResolver(maintenanceSchema),
  });

  useEffect(() => {
    if (!loading && settings) {
      reset({
        maintenanceMode: settings.maintenanceMode,
        maintenanceMessage: settings.maintenanceMessage,
        allowedUserIds: settings.allowedUserIds,
      });
    }
  }, [settings, loading, reset]);

  const onSubmitMaintenanceDetails = async (data: MaintenanceFormValues) => {
    try {
      await updateSystemSettings({ 
        maintenanceMessage: data.maintenanceMessage,
        allowedUserIds: data.allowedUserIds,
      });
      toast({
        title: "Detalhes de Manutenção Salvos",
        description: "A mensagem e os usuários autorizados foram atualizados.",
      });
      reset(data);
    } catch {
      toast({
        title: 'Erro ao Salvar',
        description: 'Não foi possível salvar os detalhes da manutenção.',
        variant: 'destructive',
      });
    }
  };
  
  const handleMaintenanceToggle = async (checked: boolean) => {
    setIsUpdatingSwitch(true);
    try {
        await updateSystemSettings({ maintenanceMode: checked });
        toast({
            title: `Modo de Manutenção ${checked ? 'ATIVADO' : 'DESATIVADO'}`,
            description: `A plataforma agora está ${checked ? 'restrita a usuários autorizados' : 'acessível a todos'}.`,
            variant: checked ? 'destructive' : 'default',
        });
    } catch {
        toast({
            title: "Erro",
            description: "Não foi possível alterar o modo de manutenção.",
            variant: "destructive"
        });
    } finally {
        setIsUpdatingSwitch(false);
    }
  };

  const allowedUserIds = watch('allowedUserIds') || [];
  const { collaborators } = useCollaborators();

  const getRecipientDescription = (ids: string[]) => {
      if (!ids || ids.length === 0) return 'Nenhum usuário extra autorizado.';
      if (ids.length === 1) return '1 usuário autorizado.';
      return `${ids.length} usuários autorizados.`;
  }
  
  return (
    <>
      <Card>
        <CardHeader>
            <CardTitle className="flex items-center gap-2"><Construction className="h-6 w-6"/>Modo de Manutenção</CardTitle>
            <CardDescription>
                Ative para suspender o acesso, exceto para Super Admins e usuários autorizados.
            </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className={cn(
                "rounded-lg border p-4 transition-colors duration-300",
                settings.maintenanceMode ? 'bg-red-500/10 border-red-500/20' : 'bg-green-500/10 border-green-500/20'
            )}>
                <div className="flex items-center space-x-4">
                    <div className="flex-1 space-y-1">
                        <Label htmlFor="maintenance-mode-switch" className="text-base font-bold">
                        {settings.maintenanceMode ? "MANUTENÇÃO ATIVA" : "MANUTENÇÃO INATIVA"}
                        </Label>
                        <p className="text-sm text-muted-foreground">
                        {settings.maintenanceMode 
                            ? "Acesso restrito a usuários autorizados."
                            : "Acesso liberado para todos os colaboradores."
                        }
                        </p>
                    </div>
                     <Switch
                        id="maintenance-mode-switch"
                        checked={settings.maintenanceMode}
                        onCheckedChange={handleMaintenanceToggle}
                        disabled={isUpdatingSwitch || loading}
                        className="data-[state=checked]:bg-[hsl(0,72%,51%)] data-[state=unchecked]:bg-[hsl(142,71%,45%)]"
                    />
                </div>
            </div>
             <form onSubmit={handleSubmit(onSubmitMaintenanceDetails)} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="maintenanceMessage">Mensagem de Manutenção</Label>
                    <Textarea
                        id="maintenanceMessage"
                        {...register('maintenanceMessage')}
                        rows={4}
                        placeholder="Digite a mensagem que será exibida na tela de login durante a manutenção..."
                        disabled={isFormSubmitting}
                    />
                    {errors.maintenanceMessage && <p className="text-sm text-destructive mt-1">{errors.maintenanceMessage.message}</p>}
                </div>
                <div className="space-y-2">
                    <Label>Usuários Autorizados na Manutenção</Label>
                    <p className="text-sm text-muted-foreground">
                        Estes usuários poderão acessar a plataforma mesmo com o modo de manutenção ativo.
                        Super Admins sempre têm acesso.
                    </p>
                    <Button type="button" variant="outline" className="w-full justify-start text-left" onClick={() => setIsSelectionModalOpen(true)}>
                        <Users className="mr-2 h-4 w-4" />
                        <span>{getRecipientDescription(allowedUserIds)}</span>
                    </Button>
                </div>
                 <div className="flex justify-end">
                    <Button type="submit" disabled={isFormSubmitting} className="bg-admin-primary hover:bg-admin-primary/90 shadow-lg">
                        {isFormSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Salvar Detalhes da Manutenção
                    </Button>
                </div>
            </form>
        </CardContent>
      </Card>

      <RecipientSelectionModal
        isOpen={isSelectionModalOpen}
        onClose={() => setIsSelectionModalOpen(false)}
        allCollaborators={collaborators}
        selectedIds={allowedUserIds}
        onConfirm={(newIds) => {
            const finalIds = newIds.includes('all') ? [] : newIds;
            setValue('allowedUserIds', finalIds, { shouldDirty: true, shouldValidate: true });
            setIsSelectionModalOpen(false);
        }}
      />
    </>
  );
}


function LegalDocsCard() {
    const { settings, loading, updateSystemSettings } = useSystemSettings();
    const { collaborators } = useCollaborators();

    const termsForm = useForm<TermsFormValues>({
        resolver: zodResolver(termsSchema),
    });

    const privacyForm = useForm<PrivacyFormValues>({
        resolver: zodResolver(privacySchema),
    });
    const resetTerms = termsForm.reset;
    const resetPrivacy = privacyForm.reset;

    useEffect(() => {
        if (!loading && settings) {
            resetTerms({
                termsUrl: settings.termsUrl,
            });
            resetPrivacy({
                privacyPolicyUrl: settings.privacyPolicyUrl,
            });
        }
    }, [settings, loading, resetTerms, resetPrivacy]);

    const onSubmitTerms = async (data: TermsFormValues) => {
        const currentVersion = settings.termsVersion || 1;
        const newVersion = currentVersion + 1;
        
        try {
            await updateSystemSettings({
                termsUrl: data.termsUrl,
                termsVersion: newVersion,
            });
            toast({
                title: "Termos de Uso Publicados",
                description: `A versão foi atualizada para ${newVersion.toFixed(1)} e uma nova rodada de aceite será iniciada.`,
            });
            termsForm.reset(data);
        } catch {
            toast({ title: 'Erro ao Salvar', description: 'Não foi possível salvar os Termos de Uso.', variant: 'destructive' });
        }
    };
    
    const onSubmitPrivacy = async (data: PrivacyFormValues) => {
        const currentVersion = settings.privacyPolicyVersion || 1;
        const newVersion = currentVersion + 1;
        try {
            await updateSystemSettings({
                privacyPolicyUrl: data.privacyPolicyUrl,
                privacyPolicyVersion: newVersion,
            });
            toast({ title: "Política de Privacidade Salva", description: `A URL foi atualizada com sucesso para a versão ${newVersion.toFixed(1)}.` });
            privacyForm.reset(data);
        } catch {
            toast({ title: 'Erro ao Salvar', description: 'Não foi possível salvar a Política de Privacidade.', variant: 'destructive' });
        }
    };
    
    const pendingAcceptanceCount = useMemo(() => {
        if (loading || !collaborators.length) return 0;
        return collaborators.filter(c => (c.acceptedTermsVersion || 0) < settings.termsVersion).length;
    }, [collaborators, settings.termsVersion, loading]);
    
    return (
         <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><FileText className="h-6 w-6"/>Gerenciamento de Documentos Legais</CardTitle>
                <CardDescription>
                    Gerencie os links para os Termos de Uso e Política de Privacidade.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
                 <form onSubmit={termsForm.handleSubmit(onSubmitTerms)} className="space-y-4">
                    <div className="p-4 border rounded-lg bg-background">
                         <h3 className="font-semibold text-lg">Termos de Uso</h3>
                         <p className="text-sm text-muted-foreground mb-4">Atualize o link e salve para forçar uma nova rodada de aceite pelos usuários.</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                            <div className="space-y-2">
                                <Label>Versão Atual</Label>
                                <div className="h-10 px-3 py-2 border rounded-md bg-muted text-muted-foreground w-24 flex items-center">
                                    {(settings.termsVersion || 1).toFixed(1)}
                                </div>
                            </div>
                             <div className="grid grid-cols-2 gap-2">
                                <div className="p-3 border rounded-md bg-muted/50 flex flex-col items-center justify-center gap-1">
                                    <UserCheck className="h-6 w-6 text-green-600" />
                                    <p className="text-xl font-bold">{collaborators.length - pendingAcceptanceCount}</p>
                                    <p className="text-xs text-muted-foreground">Aceites</p>
                                </div>
                                <div className="p-3 border rounded-md bg-muted/50 flex flex-col items-center justify-center gap-1">
                                    <Users className="h-6 w-6 text-yellow-600" />
                                    <p className="text-xl font-bold">{pendingAcceptanceCount}</p>
                                    <p className="text-xs text-muted-foreground">Pendentes</p>
                                </div>
                             </div>
                        </div>
                        <div className="space-y-2 mt-4">
                            <Label htmlFor="termsUrl">URL dos Termos de Uso (.docx)</Label>
                            <Input id="termsUrl" {...termsForm.register('termsUrl')} placeholder="Cole a URL pública do seu arquivo .docx aqui..."/>
                            <p className="text-xs text-muted-foreground mt-1">Este documento será exibido no modal de aceite.</p>
                            {termsForm.formState.errors.termsUrl && <p className="text-sm text-destructive mt-1">{termsForm.formState.errors.termsUrl.message}</p>}
                        </div>
                        <div className="flex justify-end mt-4">
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button type="button" disabled={!termsForm.formState.isDirty} className="bg-admin-primary hover:bg-admin-primary/90">
                                        Salvar e Publicar Nova Versão
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Confirmar Nova Versão?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Ao salvar, a versão dos Termos de Uso será incrementada para {(settings.termsVersion + 1).toFixed(1)}. Todos os usuários serão solicitados a aceitar os novos termos no próximo acesso. Deseja continuar?
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={termsForm.handleSubmit(onSubmitTerms)}>Sim, publicar nova versão</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </div>
                </form>

                 <form onSubmit={privacyForm.handleSubmit(onSubmitPrivacy)} className="space-y-4">
                     <div className="p-4 border rounded-lg bg-background">
                        <h3 className="font-semibold text-lg">Política de Privacidade</h3>
                        <p className="text-sm text-muted-foreground mb-4">Atualize o link que será exibido no FAQ. Esta ação não solicita novo aceite dos usuários.</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                             <div className="space-y-2">
                                <Label>Versão Atual</Label>
                                <div className="h-10 px-3 py-2 border rounded-md bg-muted text-muted-foreground w-24 flex items-center">
                                    {(settings.privacyPolicyVersion || 1).toFixed(1)}
                                </div>
                            </div>
                        </div>
                        <div className="space-y-2 mt-4">
                            <Label htmlFor="privacyPolicyUrl">URL da Política de Privacidade (.docx)</Label>
                            <Input id="privacyPolicyUrl" {...privacyForm.register('privacyPolicyUrl')} placeholder="Cole a URL pública do seu arquivo .docx aqui..."/>
                            {privacyForm.formState.errors.privacyPolicyUrl && <p className="text-sm text-destructive mt-1">{privacyForm.formState.errors.privacyPolicyUrl.message}</p>}
                        </div>
                         <div className="flex justify-end mt-4">
                             <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button type="button" disabled={!privacyForm.formState.isDirty} className="bg-admin-primary hover:bg-admin-primary/90">
                                        Salvar e Publicar Nova Versão
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Confirmar Nova Versão?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Ao salvar, a versão da Política de Privacidade será incrementada para {(settings.privacyPolicyVersion + 1).toFixed(1)} para fins de controle, mas não solicitará um novo aceite dos usuários. Deseja continuar?
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={privacyForm.handleSubmit(onSubmitPrivacy)}>Sim, publicar nova versão</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}


export function MaintenanceMode() {
  return (
    <div className="space-y-6">
      <SuperAdminsCard />
      <CollaboratorImporterAdminsCard />
      <MaintenanceCard />
    </div>
  );
}
