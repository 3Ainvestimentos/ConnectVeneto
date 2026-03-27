
"use client";

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { PollType, usePolls } from '@/contexts/PollsContext';
import { useAuth } from '@/contexts/AuthContext';
import { getCollaboratorUserId, useCollaborators } from '@/contexts/CollaboratorsContext';
import { toast } from '@/hooks/use-toast';
import { findCollaboratorByEmail } from '@/lib/email-utils';
import { Loader2 } from 'lucide-react';
import { Textarea } from '../ui/textarea';

const OTHER_OPTION_VALUE = '__other__';

interface PollModalProps {
  poll: PollType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function PollModal({ poll, open, onOpenChange }: PollModalProps) {
  const [selectedValue, setSelectedValue] = useState<string>('');
  const [otherValue, setOtherValue] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { submitResponse } = usePolls();
  const { user } = useAuth();
  const { collaborators } = useCollaborators();
  
  const isOtherSelected = selectedValue === OTHER_OPTION_VALUE;

  const handleSubmit = async () => {
    let finalAnswer = selectedValue;
    if (isOtherSelected) {
        finalAnswer = otherValue.trim();
    }
    
    if (!finalAnswer.trim()) {
      toast({ title: 'Por favor, forneça uma resposta.', variant: 'destructive' });
      return;
    }

    const currentUser = findCollaboratorByEmail(collaborators, user?.email);
    if (!currentUser) {
      toast({ title: 'Erro de autenticação', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      await submitResponse(poll.id, {
        userId: getCollaboratorUserId(currentUser) || '',
        userName: currentUser.name,
        answer: finalAnswer,
        answeredAt: new Date().toISOString(),
      });
      toast({ title: 'Obrigado por responder!', description: 'Sua resposta foi registrada.', variant: 'success' });
      onOpenChange(false);
      setSelectedValue('');
      setOtherValue('');
    } catch (error) {
      toast({ title: 'Erro ao enviar resposta', description: (error as Error).message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const isMultipleChoice = poll.type === 'multiple-choice';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{poll.question}</DialogTitle>
          <DialogDescription>Sua opinião é importante para nós.</DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {isMultipleChoice ? (
            <RadioGroup value={selectedValue} onValueChange={setSelectedValue}>
              <div className="space-y-2">
                {poll.options.map((option, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <RadioGroupItem value={option} id={`option-${index}`} />
                    <Label htmlFor={`option-${index}`}>{option}</Label>
                  </div>
                ))}
                {poll.allowOtherOption && (
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value={OTHER_OPTION_VALUE} id="option-other" />
                        <Label htmlFor="option-other">Outros</Label>
                    </div>
                )}
              </div>
              {isOtherSelected && (
                  <div className="mt-2 pl-6">
                      <Textarea
                        placeholder="Por favor, especifique sua resposta"
                        value={otherValue}
                        onChange={(e) => setOtherValue(e.target.value)}
                        rows={3}
                      />
                  </div>
              )}
            </RadioGroup>
          ) : (
             <div className="space-y-2">
                <Label htmlFor="open-text-response">Sua resposta:</Label>
                <Textarea
                    id="open-text-response"
                    value={selectedValue}
                    onChange={(e) => setSelectedValue(e.target.value)}
                    placeholder="Digite sua resposta aqui..."
                    rows={4}
                />
             </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Fechar
          </Button>
          <Button type="submit" onClick={handleSubmit} disabled={isSubmitting || !selectedValue.trim() || (isOtherSelected && !otherValue.trim())} className="bg-success hover:bg-success/90">
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enviar Resposta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
