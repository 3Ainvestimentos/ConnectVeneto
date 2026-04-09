
"use client";

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface TermsOfUseModalProps {
  isOpen: boolean;
  termsUrl: string;
  onAccept: () => Promise<boolean>;
  onDecline: () => void;
}

export function TermsOfUseModal({ isOpen, termsUrl, onAccept, onDecline }: TermsOfUseModalProps) {
  const [isChecked, setIsChecked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAccept = async () => {
    setIsSubmitting(true);
    const success = await onAccept();
    if (!success) {
      setIsSubmitting(false); // Only stop loading on failure, as success will unmount
    }
  };

  const handleDecline = () => {
    toast({
        title: "Acesso Recusado",
        description: "Você precisa aceitar os termos para utilizar a plataforma.",
        variant: "destructive"
    });
    onDecline();
  };

  const viewerUrl = `https://docs.google.com/gview?url=${encodeURIComponent(termsUrl)}&embedded=true`;

  return (
    <Dialog open={isOpen}>
      <DialogContent className="sm:max-w-3xl flex flex-col h-[90vh]" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-2xl font-headline">Termos de Uso e Política de Privacidade</DialogTitle>
          <DialogDescription>
            Por favor, leia e aceite os termos para continuar.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-grow min-h-0 border rounded-md bg-muted/30 flex items-center justify-center">
            {termsUrl ? (
                <iframe 
                    src={viewerUrl}
                    className="w-full h-full border-0"
                    title="Termos de Uso"
                />
            ) : (
                <div className="text-center p-6 text-muted-foreground">
                   <p className="font-semibold text-lg text-foreground mb-2">Termos de Uso Indisponíveis</p>
                   <p>O administrador do sistema ainda não configurou o link para os Termos de Uso e Política de Privacidade.</p>
                   <p className="text-sm mt-4">Você ainda pode aceitar para prosseguir se foi orientado a isso, ou aguardar a configuração.</p>
                </div>
            )}
        </div>
        <div className="flex items-center space-x-2 pt-4">
          <Checkbox id="terms-checkbox" checked={isChecked} onCheckedChange={(checked) => setIsChecked(!!checked)} />
          <Label htmlFor="terms-checkbox" className="font-medium text-sm">
            Eu li e concordo com os Termos de Uso e a Política de Privacidade.
          </Label>
        </div>
        <DialogFooter>
          <Button variant="destructive" onClick={handleDecline}>Recusar e Sair</Button>
          <Button onClick={handleAccept} disabled={!isChecked || isSubmitting} className="bg-success hover:bg-success/90">
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
            Aceitar e Continuar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
