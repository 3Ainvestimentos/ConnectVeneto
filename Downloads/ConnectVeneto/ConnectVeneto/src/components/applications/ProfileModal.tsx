
"use client";

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { useCollaborators } from '@/contexts/CollaboratorsContext';
import { Separator } from '../ui/separator';
import { User, Building, Briefcase, Pyramid, MapPin, Users, Fingerprint, ClipboardCopy } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useSystemSettings } from '@/contexts/SystemSettingsContext';

interface ProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ProfileModal({ open, onOpenChange }: ProfileModalProps) {
  const { user, currentUserCollab } = useAuth(); // Using currentUserCollab from AuthContext now
  const { settings } = useSystemSettings();

  const handleCopyDiagnostics = () => {
    if (!user || !currentUserCollab) {
      toast({
        title: "Erro",
        description: "Não foi possível coletar os dados de diagnóstico.",
        variant: "destructive"
      });
      return;
    }

    const diagnostics = `
--- DADOS DE DIAGNÓSTICO DO USUÁRIO ---

[+] DADOS DE AUTENTICAÇÃO (useAuth)
------------------------------------
UID: ${user.uid}
Email: ${user.email}
Nome de Exibição: ${user.displayName}

[+] DADOS DO FIRESTORE (useCollaborators)
------------------------------------------
ID do Documento: ${currentUserCollab.id}
ID Veneto: ${currentUserCollab.idVeneto || currentUserCollab.id3a}
Email no Firestore: ${currentUserCollab.email}
Permissões: ${JSON.stringify(currentUserCollab.permissions, null, 2)}
Versão dos Termos Aceita: ${currentUserCollab.acceptedTermsVersion || 'N/A'}

[+] DADOS DE CONFIGURAÇÃO (useSystemSettings)
---------------------------------------------
Modo Manutenção: ${settings.maintenanceMode}
Mensagem de Manutenção: ${settings.maintenanceMessage}
Versão Atual dos Termos: ${settings.termsVersion}
URL dos Termos: ${settings.termsUrl}

--- FIM DOS DADOS ---
    `;

    navigator.clipboard.writeText(diagnostics.trim())
      .then(() => {
        toast({
          title: "Sucesso!",
          description: "Os dados de diagnóstico foram copiados para a sua área de transferência.",
          variant: "success",
        });
      })
      .catch(err => {
        console.error('Failed to copy diagnostics: ', err);
        toast({
          title: "Erro ao Copiar",
          description: "Não foi possível copiar os dados. Verifique as permissões do seu navegador.",
          variant: "destructive"
        });
      });
  };

  if (!user) return null;
  
  const displayName = currentUserCollab?.name || user.displayName;
  const displayEmail = currentUserCollab?.email || user.email;
  const displayPhotoUrl = currentUserCollab?.photoURL || user.photoURL || undefined;
  const displayAvatarInitial = displayName ? displayName.charAt(0).toUpperCase() : <User size={48} />;

  const InfoItem = ({ icon: Icon, label, value }: { icon: React.ElementType, label: string, value?: string }) => (
    <div className="flex items-center gap-4">
        <Icon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
        <div className="text-sm">
            <p className="font-semibold text-foreground">{label}</p>
            <p className="text-muted-foreground">{value || '-'}</p>
        </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl font-body p-0">
        <div className="flex flex-col md:flex-row">
            {/* Left side */}
            <div className="flex flex-col items-center justify-center p-8 bg-muted/50 md:w-2/5 text-center">
                <Avatar className="h-28 w-28 mb-4 border-4 border-background">
                    <AvatarImage src={displayPhotoUrl} alt={displayName || "User Avatar"} />
                    <AvatarFallback className="text-4xl bg-muted">
                        {displayAvatarInitial}
                    </AvatarFallback>
                </Avatar>
                <h2 className="font-headline text-2xl font-bold text-foreground">{displayName}</h2>
                <p className="text-sm text-muted-foreground">{displayEmail}</p>
            </div>

            {/* Right side */}
            <div className="p-8 flex flex-col flex-1">
                <DialogHeader className="mb-4">
                    <DialogTitle className="font-headline text-xl">Detalhes do Colaborador</DialogTitle>
                </DialogHeader>

                {currentUserCollab ? (
                  <div className="space-y-4">
                      <InfoItem icon={Fingerprint} label="ID Veneto" value={currentUserCollab.idVeneto || currentUserCollab.id3a} />
                      <Separator />
                      <InfoItem icon={Briefcase} label="Cargo" value={currentUserCollab.position} />
                      <Separator />
                      <InfoItem icon={Building} label="Área" value={currentUserCollab.area} />
                      <Separator />
                      <InfoItem icon={Users} label="Líder" value={currentUserCollab.leader} />
                       <Separator />
                      <InfoItem icon={Pyramid} label="Eixo" value={currentUserCollab.axis} />
                       <Separator />
                      <InfoItem icon={MapPin} label="Cidade" value={currentUserCollab.city} />
                  </div>
                ) : (
                <div className="py-4 text-center text-muted-foreground">
                    <p>Informações detalhadas do colaborador não encontradas.</p>
                </div>
                )}
                 <DialogFooter className="!justify-center mt-auto pt-4 pb-0">
                    <Button
                        variant="ghost"
                        onClick={handleCopyDiagnostics}
                        className="text-[10px] text-muted-foreground hover:bg-transparent hover:text-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
                    >
                        <ClipboardCopy className="mr-2 h-3 w-3" />
                        Copiar Dados de Diagnóstico
                    </Button>
                </DialogFooter>
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
