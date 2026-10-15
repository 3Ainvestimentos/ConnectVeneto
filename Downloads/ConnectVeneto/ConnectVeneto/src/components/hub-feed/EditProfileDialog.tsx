"use client";

import { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { useHubMock } from '@/lib/hub-mock/store';

const splitList = (s: string) => s.split(/[,\n]/).map((x) => x.trim()).filter(Boolean);

/**
 * Edição do Perfil pela própria pessoa: só os Dados pessoais. Cargo, área, equipe, gestor e histórico
 * são do RH e aparecem bloqueados, para deixar claro onde pedir a alteração.
 */
export function EditProfileDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { me, updateMyProfile } = useHubMock();
  const [bio, setBio] = useState('');
  const [responsibilities, setResponsibilities] = useState('');
  const [interests, setInterests] = useState('');
  const [phone, setPhone] = useState('');
  const [chat, setChat] = useState('');

  useEffect(() => {
    if (!open) return;
    setBio(me.bio ?? '');
    setResponsibilities((me.responsibilities ?? []).join(', '));
    setInterests((me.interests ?? []).join(', '));
    setPhone(me.phone ?? '');
    setChat(me.chat ?? '');
  }, [open, me]);

  const save = () => {
    updateMyProfile({
      bio: bio.trim() || undefined,
      responsibilities: splitList(responsibilities),
      interests: splitList(interests),
      phone: phone.trim() || undefined,
      chat: chat.trim() || undefined,
    });
    toast({ title: 'Perfil atualizado' });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar meu perfil</DialogTitle>
          <DialogDescription>O que você escreve aqui aparece para todos no Connect.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="ep-bio">Sobre mim</Label>
            <Textarea id="ep-bio" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Em uma ou duas frases: o que você faz e como gosta de trabalhar." />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ep-resp">No que trabalho</Label>
            <Input id="ep-resp" value={responsibilities} onChange={(e) => setResponsibilities(e.target.value)} placeholder="Connect, TrackFlow, Integrações" />
            <p className="text-xs text-muted-foreground">Separe por vírgula. Ajuda quem precisa saber a quem procurar.</p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ep-int">Interesses</Label>
            <Input id="ep-int" value={interests} onChange={(e) => setInterests(e.target.value)} placeholder="corrida, fotografia, xadrez" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="ep-phone">Telefone / WhatsApp</Label>
              <Input id="ep-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 9 0000-0000" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ep-chat">Google Chat</Label>
              <Input id="ep-chat" value={chat} onChange={(e) => setChat(e.target.value)} placeholder="seu.nome@venetomfo.com.br" />
            </div>
          </div>

          <div className="rounded-lg border border-dashed bg-muted/40 p-3 text-xs text-muted-foreground">
            <p className="mb-1 flex items-center gap-1 font-semibold text-foreground">
              <Lock className="h-3 w-3" /> Mantido pelo RH
            </p>
            <p>Cargo, área, equipe, unidade, gestor e histórico de cargos são atualizados pelo RH. Se algo estiver errado, abra uma solicitação em RH.</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={save}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
