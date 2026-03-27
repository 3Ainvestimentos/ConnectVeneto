
"use client";

import React, { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useSystemSettings } from '@/contexts/SystemSettingsContext';
import { toast } from '@/hooks/use-toast';
import { Loader2, Rss, Eye } from 'lucide-react';
import SuperAdminGuard from '../auth/SuperAdminGuard';
import { DailyRssModal } from '../rss/DailyRssModal';

const newsletterSchema = z.object({
  isRssNewsletterActive: z.boolean(),
  rssNewsletterUrl: z.string().url("Por favor, insira uma URL de feed RSS válida.").or(z.literal('')),
}).superRefine((data, ctx) => {
    if (data.isRssNewsletterActive && !data.rssNewsletterUrl) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['rssNewsletterUrl'],
            message: 'A URL do feed RSS é obrigatória quando a newsletter está ativa.',
        });
    }
});

type NewsletterFormValues = z.infer<typeof newsletterSchema>;

export function ManageNewsletter() {
  const { settings, loading, updateSystemSettings } = useSystemSettings();
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const { register, handleSubmit, reset, watch, control, formState: { errors, isSubmitting } } = useForm<NewsletterFormValues>({
    resolver: zodResolver(newsletterSchema),
  });

  const rssUrlValue = watch("rssNewsletterUrl");

  useEffect(() => {
    if (!loading && settings) {
      reset({
        isRssNewsletterActive: settings.isRssNewsletterActive || false,
        rssNewsletterUrl: settings.rssNewsletterUrl || '',
      });
    }
  }, [settings, loading, reset]);

  const onSubmit = async (data: NewsletterFormValues) => {
    try {
      await updateSystemSettings(data);
      toast({
        title: "Configurações Salvas",
        description: "As configurações da newsletter foram atualizadas com sucesso.",
      });
    } catch {
      toast({
        title: 'Erro ao Salvar',
        description: 'Não foi possível salvar as configurações.',
        variant: 'destructive',
      });
    }
  };
  
  return (
    <SuperAdminGuard>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Rss className="h-6 w-6"/>Configurar Newsletter Diária</CardTitle>
          <CardDescription>
            Ative e configure o modal da newsletter diária que aparece para os usuários ao logar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="flex items-center space-x-2 rounded-lg border p-4">
              <Controller
                name="isRssNewsletterActive"
                control={control}
                render={({ field }) => (
                  <Switch
                    id="isRssNewsletterActive"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
              <Label htmlFor="isRssNewsletterActive" className="text-base font-medium">
                Ativar Newsletter Diária
              </Label>
            </div>

            <div className="space-y-2">
                <Label htmlFor="rssNewsletterUrl">URL do Feed RSS</Label>
                <Input
                    id="rssNewsletterUrl"
                    {...register('rssNewsletterUrl')}
                    placeholder="https://exemplo.com/feed.xml"
                    disabled={isSubmitting || loading}
                />
                <p className="text-xs text-muted-foreground">Insira o link do feed RSS que será usado para gerar a newsletter.</p>
                {errors.rssNewsletterUrl && <p className="text-sm text-destructive mt-1">{errors.rssNewsletterUrl.message}</p>}
            </div>
            
            <div className="flex justify-between items-center">
               <Button type="button" variant="outline" onClick={() => setIsPreviewOpen(true)} disabled={!rssUrlValue}>
                <Eye className="mr-2 h-4 w-4" />
                Testar Modal
              </Button>
              <Button type="submit" disabled={isSubmitting || loading} className="bg-admin-primary hover:bg-admin-primary/90">
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Configurações
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      {/* The modal for previewing */}
      <DailyRssModal forceOpen={isPreviewOpen} onOpenChange={setIsPreviewOpen} />
    </SuperAdminGuard>
  );
}
