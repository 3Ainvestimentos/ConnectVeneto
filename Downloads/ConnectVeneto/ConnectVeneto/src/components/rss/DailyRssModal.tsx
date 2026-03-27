
"use client";

import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useSystemSettings } from '@/contexts/SystemSettingsContext';
import { useLocalStorage } from '@/hooks/use-local-storage';

interface DailyRssModalProps {
  forceOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function DailyRssModal({ forceOpen = false, onOpenChange }: DailyRssModalProps) {
  const { settings, loading: settingsLoading } = useSystemSettings();
  const [lastSeen, setLastSeen] = useLocalStorage<string>('dailyRssLastSeen', '');
  const [hidePermanently] = useLocalStorage<boolean>('hideDailyRss', false);
  const [isOpen, setIsOpen] = useState(false);

  const newsletterUrl = settings.rssNewsletterUrl;

  useEffect(() => {
    if (forceOpen) {
      setIsOpen(true);
      return;
    }

    if (settingsLoading) {
      return;
    }

    if (!settings.isRssNewsletterActive) {
      return;
    }

    if (hidePermanently) {
      return;
    }

    if (!newsletterUrl) {
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    if (lastSeen !== today) {
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 2500); // Delay opening the modal

      return () => {
        clearTimeout(timer);
      };
    }
  }, [settingsLoading, settings.isRssNewsletterActive, lastSeen, hidePermanently, forceOpen, newsletterUrl]);

  const handleClose = () => {
    if (forceOpen && onOpenChange) {
      onOpenChange(false);
    } else {
      const today = new Date().toISOString().split('T')[0];
      // Atualiza lastSeen para hoje, impedindo que apareça novamente hoje
      setLastSeen(today);
    }
    setIsOpen(false);
  };

  if (!newsletterUrl) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-4xl flex flex-col h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl font-headline">
            DailyFin
          </DialogTitle>
          <DialogDescription>
            As principais notícias do mercado para começar o seu dia bem informado.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-grow min-h-0 border rounded-md overflow-hidden">
          <iframe
            src={newsletterUrl}
            className="w-full h-full border-0"
            title="Newsletter"
          />
        </div>
        <DialogFooter className="flex justify-end items-center pt-4 border-t">
          <DialogClose asChild>
            <Button type="button" variant="outline" className="hover:bg-muted">Fechar</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
