"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ImageOff,
  Loader2,
  PlusCircle,
  RotateCcw,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { uploadFile } from "@/lib/firestore-service";
import { useMixServicosSlides } from "@/hooks/useMixServicosSlides";
import { defaultMixServicosSlides, type RegrasComerciaisSlide } from "@/config/regras-comerciais-slides";

const STORAGE_FOLDER = "regras-comerciais/mix";
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];

type DraftSlide = RegrasComerciaisSlide & {
  /** Chave estável só para o React — não é persistida. */
  key: string;
};

let draftKeySeq = 0;
const nextDraftKey = () => `slide-${(draftKeySeq += 1)}`;

const toDraft = (slides: RegrasComerciaisSlide[]): DraftSlide[] =>
  slides.map((slide) => ({ ...slide, key: nextDraftKey() }));

const isSameList = (a: RegrasComerciaisSlide[], b: RegrasComerciaisSlide[]): boolean =>
  a.length === b.length && a.every((slide, i) => slide.src === b[i].src && slide.alt === b[i].alt);

export function ManageMixServicosSlides() {
  const { slides, isCustomized, loading, saveSlides, isSaving } = useMixServicosSlides();
  const [draft, setDraft] = useState<DraftSlide[]>([]);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const fileInputsRef = useRef<Record<string, HTMLInputElement | null>>({});

  // Sincroniza o rascunho com o Firestore só enquanto não há edição pendente,
  // para não sobrescrever o que a pessoa está mexendo quando o listener disparar.
  const isDirty = !isSameList(
    draft.map(({ src, alt }) => ({ src, alt })),
    slides
  );
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (loading) return;
    if (hydratedRef.current && isDirty) return;
    setDraft(toDraft(slides));
    hydratedRef.current = true;
    // `isDirty` é lido de propósito sem entrar nas deps: só queremos reidratar
    // quando os slides vindos do Firestore mudarem.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides, loading]);

  const updateSlide = (key: string, patch: Partial<RegrasComerciaisSlide>) => {
    setDraft((prev) => prev.map((slide) => (slide.key === key ? { ...slide, ...patch } : slide)));
  };

  const moveSlide = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    setDraft((prev) => {
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const removeSlide = (key: string) => {
    setDraft((prev) => prev.filter((slide) => slide.key !== key));
  };

  const addSlide = () => {
    setDraft((prev) => [...prev, { key: nextDraftKey(), src: "", alt: "" }]);
  };

  const restoreDefaults = () => {
    if (!window.confirm("Descartar as alterações e voltar para a apresentação padrão?")) return;
    setDraft(toDraft(defaultMixServicosSlides));
  };

  const handleFileSelected = async (key: string, file: File | undefined) => {
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast({
        title: "Formato não suportado",
        description: "Use PNG, JPG ou WebP.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      toast({
        title: "Imagem muito grande",
        description: "O limite por slide é 8 MB.",
        variant: "destructive",
      });
      return;
    }

    setUploadingKey(key);
    try {
      const url = await uploadFile(file, STORAGE_FOLDER, key, file.name);
      updateSlide(key, { src: url });
      toast({ title: "Imagem enviada", description: "Não esqueça de salvar a apresentação." });
    } catch (error) {
      toast({
        title: "Falha no upload",
        description: error instanceof Error ? error.message : "Não foi possível enviar a imagem.",
        variant: "destructive",
      });
    } finally {
      setUploadingKey(null);
      const input = fileInputsRef.current[key];
      if (input) input.value = "";
    }
  };

  const handleSave = async () => {
    const payload = draft.map(({ src, alt }) => ({ src: src.trim(), alt: alt.trim() }));

    if (payload.length === 0) {
      toast({
        title: "Nada para salvar",
        description: "A apresentação precisa de pelo menos um slide.",
        variant: "destructive",
      });
      return;
    }

    const incomplete = payload.findIndex((slide) => !slide.src || slide.alt.length < 3);
    if (incomplete !== -1) {
      toast({
        title: `Slide ${incomplete + 1} incompleto`,
        description: "Cada slide precisa de uma imagem e de uma descrição com 3+ caracteres.",
        variant: "destructive",
      });
      return;
    }

    try {
      await saveSlides(payload);
      toast({
        title: "Apresentação atualizada",
        description: `${payload.length} slide(s) publicado(s) em Regras Comerciais.`,
      });
    } catch (error) {
      toast({
        title: "Erro ao salvar",
        description: error instanceof Error ? error.message : "Não foi possível salvar.",
        variant: "destructive",
      });
    }
  };

  if (loading && draft.length === 0) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Apresentação — Mix de Serviços</CardTitle>
          <CardDescription>
            Imagens do carrossel exibido em Regras Comerciais. A ordem aqui é a ordem dos slides.
          </CardDescription>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="outline" onClick={restoreDefaults} disabled={isSaving}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Restaurar padrão
          </Button>
          <Button variant="outline" onClick={addSlide} disabled={isSaving}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Adicionar slide
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !isDirty}>
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Salvar apresentação
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {!isCustomized && (
          <Alert>
            <AlertTitle className="font-headline">Apresentação padrão</AlertTitle>
            <AlertDescription className="font-body">
              Estes são os slides versionados no código. Ao salvar, a apresentação passa a ser
              gerenciada por esta tela.
            </AlertDescription>
          </Alert>
        )}

        {isDirty && (
          <p className="font-body text-sm text-[#e1ca5f]">
            Você tem alterações não salvas.
          </p>
        )}

        {draft.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center">
            <p className="font-body text-sm text-muted-foreground">
              Nenhum slide. Use “Adicionar slide” para começar.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {draft.map((slide, index) => (
              <li
                key={slide.key}
                className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 sm:flex-row"
              >
                <div className="flex items-center gap-2 sm:flex-col sm:justify-center">
                  <span className="w-6 text-center font-headline text-sm text-muted-foreground">
                    {index + 1}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => moveSlide(index, -1)}
                    disabled={index === 0}
                    aria-label={`Mover slide ${index + 1} para cima`}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => moveSlide(index, 1)}
                    disabled={index === draft.length - 1}
                    aria-label={`Mover slide ${index + 1} para baixo`}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex h-24 w-40 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-white">
                  {slide.src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={slide.src}
                      alt={slide.alt || `Pré-visualização do slide ${index + 1}`}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <ImageOff className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>

                <div className="flex-1 space-y-3">
                  <div>
                    <Label htmlFor={`${slide.key}-alt`}>Descrição (texto alternativo)</Label>
                    <Input
                      id={`${slide.key}-alt`}
                      value={slide.alt}
                      onChange={(e) => updateSlide(slide.key, { alt: e.target.value })}
                      placeholder="Ex.: Tabela de produtos e preços"
                      disabled={isSaving}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`${slide.key}-src`}>Imagem (URL ou caminho interno)</Label>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Input
                        id={`${slide.key}-src`}
                        value={slide.src}
                        onChange={(e) => updateSlide(slide.key, { src: e.target.value })}
                        placeholder="https://… ou /regras-comerciais/mix/03.png"
                        disabled={isSaving}
                      />
                      <input
                        ref={(el) => {
                          fileInputsRef.current[slide.key] = el;
                        }}
                        type="file"
                        accept={ACCEPTED_TYPES.join(",")}
                        className="hidden"
                        onChange={(e) => handleFileSelected(slide.key, e.target.files?.[0])}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="shrink-0"
                        onClick={() => fileInputsRef.current[slide.key]?.click()}
                        disabled={isSaving || uploadingKey === slide.key}
                      >
                        {uploadingKey === slide.key ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="mr-2 h-4 w-4" />
                        )}
                        Enviar imagem
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="flex items-start justify-end">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeSlide(slide.key)}
                    disabled={isSaving}
                    aria-label={`Remover slide ${index + 1}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
