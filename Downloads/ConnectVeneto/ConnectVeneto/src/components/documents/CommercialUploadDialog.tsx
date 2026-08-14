"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Paperclip, SkipForward, Sparkles, Upload, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  resolveUploadMime,
  UPLOAD_ACCEPT_ATTRIBUTE,
  UPLOAD_MIME_TO_FILE_TYPE,
  type CommercialDocument,
  type CommercialFileType,
} from "@/config/biblioteca-comercial";
import type { ExtractionResult } from "@/lib/document-text-extraction";
import {
  deleteCommercialFile,
  uploadCommercialFile,
  validateCommercialFile,
} from "@/lib/biblioteca-comercial-storage";
import {
  useUploadAssistant,
  type AssistantAnswer,
  type AssistantQuestion,
} from "@/hooks/useUploadAssistant";
import type {
  CommercialDocumentDraft,
  CommercialDocumentEdit,
} from "@/hooks/useCommercialDocuments";

type Mode = "source" | "interview" | "review";

interface CommercialUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Documento existente → o diálogo entra em modo de edição de metadados. */
  editing?: CommercialDocument | null;
  onCreate: (draft: CommercialDocumentDraft) => Promise<void>;
  onUpdate: (edit: CommercialDocumentEdit) => Promise<void>;
}

const LINK_FILE_TYPES: Array<{ value: CommercialFileType; label: string }> = [
  { value: "pdf", label: "PDF" },
  { value: "ppt", label: "Apresentação" },
  { value: "audio", label: "Áudio" },
  { value: "link", label: "Outro link" },
];

/**
 * Cadastro de documento na Biblioteca Comercial.
 *
 * O fluxo é: escolher a fonte (arquivo ou link) e escrever uma descrição breve →
 * o assistente de IA entrevista quem está subindo para cobrir as lacunas →
 * revisão dos metadados sugeridos → gravação.
 *
 * O arquivo sobe direto para o Storage (não pela API route, por causa do limite de
 * corpo da Vercel) e o metadado é criado depois; se a gravação falhar, o arquivo
 * recém-enviado é removido para não ficar órfão.
 */
export function CommercialUploadDialog({
  open,
  onOpenChange,
  editing,
  onCreate,
  onUpdate,
}: CommercialUploadDialogProps) {
  const isEditing = !!editing;
  const { ask, readFile, isThinking, isReadingFile } = useUploadAssistant();

  const [mode, setMode] = useState<Mode>("source");
  const [sourceType, setSourceType] = useState<"upload" | "link">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkFileType, setLinkFileType] = useState<CommercialFileType>("pdf");
  const [briefDescription, setBriefDescription] = useState("");

  /** Conteúdo lido do arquivo e o que contar a quem publica sobre essa leitura. */
  const [extraction, setExtraction] = useState<ExtractionResult | null>(null);
  /** Marca que a descrição veio da IA, para pedir validação em vez de parecer digitada. */
  const [hasDraftDescription, setHasDraftDescription] = useState(false);

  const [questions, setQuestions] = useState<AssistantQuestion[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [previousAnswers, setPreviousAnswers] = useState<AssistantAnswer[]>([]);
  const [round, setRound] = useState(0);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Reabrir o diálogo sempre começa do zero (ou dos dados do documento em edição).
  useEffect(() => {
    if (!open) return;
    if (editing) {
      setMode("review");
      setTitle(editing.title);
      setDescription(editing.description);
      setTags(editing.tags);
    } else {
      setMode("source");
      setSourceType("upload");
      setFile(null);
      setLinkUrl("");
      setLinkFileType("pdf");
      setBriefDescription("");
      setTitle("");
      setDescription("");
      setTags([]);
    }
    setExtraction(null);
    setHasDraftDescription(false);
    setQuestions([]);
    setAnswers([]);
    setPreviousAnswers([]);
    setRound(0);
    setTagInput("");
    setUploadProgress(null);
  }, [open, editing]);

  const effectiveFileName = file?.name ?? linkUrl;

  /** Deriva o tipo do próprio arquivo — antes vinha fixo como "pdf". */
  const effectiveFileType: CommercialFileType = useMemo(() => {
    if (sourceType === "link") return linkFileType;
    if (!file) return "pdf";
    const mime = resolveUploadMime(file.name, file.type);
    return (mime && UPLOAD_MIME_TO_FILE_TYPE[mime]) || "pdf";
  }, [sourceType, linkFileType, file]);

  const canStartAssistant = useMemo(() => {
    // Esperar a leitura evita mandar o assistente trabalhar sem o conteúdo do arquivo.
    if (isReadingFile) return false;
    if (briefDescription.trim().length < 3) return false;
    if (sourceType === "upload") return !!file;
    return /^https:\/\/\S+$/.test(linkUrl.trim());
  }, [isReadingFile, briefDescription, sourceType, file, linkUrl]);

  /**
   * Ao escolher o arquivo, lê o conteúdo e já preenche a descrição com um rascunho.
   * Quem publica revisa em vez de escrever do zero; se a leitura falhar, o campo
   * fica em branco e o motivo aparece abaixo dele.
   */
  const handleFileChange = async (selected: File | undefined) => {
    if (!selected) return;
    const validationError = validateCommercialFile(selected);
    if (validationError) {
      toast({ title: "Arquivo não aceito", description: validationError, variant: "destructive" });
      return;
    }

    setFile(selected);
    setExtraction(null);

    const mime = resolveUploadMime(selected.name, selected.type);
    const detectedType = (mime && UPLOAD_MIME_TO_FILE_TYPE[mime]) || "pdf";

    const { extraction: result, draftDescription } = await readFile(selected, detectedType);
    setExtraction(result);

    // Não sobrescreve o que a pessoa já tenha digitado.
    if (draftDescription) {
      setBriefDescription((current) => {
        if (current.trim()) return current;
        setHasDraftDescription(true);
        return draftDescription;
      });
    }
  };

  const runAssistant = async (
    accumulatedAnswers: AssistantAnswer[],
    nextRound: number,
    finalize = false
  ) => {
    const result = await ask({
      fileName: effectiveFileName,
      fileType: effectiveFileType,
      userDescription: briefDescription.trim(),
      documentText: extraction?.text ?? "",
      answers: accumulatedAnswers,
      round: nextRound,
      finalize,
    });

    if (!result) {
      // Assistente indisponível não bloqueia o cadastro: cai na revisão manual.
      toast({
        title: "Assistente indisponível",
        description: "Preencha os metadados manualmente.",
        variant: "destructive",
      });
      setTitle((current) => current || effectiveFileName.replace(/\.[^.]+$/, ""));
      setDescription((current) => current || briefDescription.trim());
      setMode("review");
      return;
    }

    if (result.status === "questions") {
      setQuestions(result.questions);
      // Campos já vêm com a resposta que o conteúdo do arquivo sugere: confirmar é
      // mais rápido que escrever, e o que a IA não soube deduzir fica em branco.
      setAnswers(result.questions.map((item) => item.suggestedAnswer ?? ""));
      setPreviousAnswers(accumulatedAnswers);
      setRound(nextRound);
      setMode("interview");
      return;
    }

    setTitle(result.title);
    setDescription(result.description);
    setTags(result.tags);
    setMode("review");
  };

  const collectAnswers = (): AssistantAnswer[] => [
    ...previousAnswers,
    ...questions.map((item, index) => ({
      question: item.question,
      answer: answers[index] ?? "",
    })),
  ];

  const handleSubmitAnswers = () => {
    void runAssistant(collectAnswers(), round + 1);
  };

  /** Pular: as perguntas não se aplicam. Gera os metadados com o que já foi dito. */
  const handleSkipQuestions = () => {
    void runAssistant(collectAnswers(), round + 1, true);
  };

  const addTag = () => {
    const normalized = tagInput.trim().toLowerCase();
    if (!normalized || tags.includes(normalized)) {
      setTagInput("");
      return;
    }
    setTags((current) => [...current, normalized]);
    setTagInput("");
  };

  const handleSave = async () => {
    if (title.trim().length < 3 || description.trim().length < 10) {
      toast({
        title: "Faltam informações",
        description: "O título precisa de 3+ caracteres e a descrição de 10+.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    let uploadedPath: string | null = null;

    try {
      if (isEditing && editing) {
        await onUpdate({
          id: editing.id,
          title: title.trim(),
          description: description.trim(),
          tags,
        });
        toast({ title: "Documento atualizado" });
        onOpenChange(false);
        return;
      }

      if (sourceType === "link") {
        await onCreate({
          title: title.trim(),
          description: description.trim(),
          tags,
          sourceType: "link",
          fileType: linkFileType,
          downloadUrl: linkUrl.trim(),
        });
      } else {
        if (!file) throw new Error("Selecione um arquivo.");
        setUploadProgress(0);
        const uploaded = await uploadCommercialFile(file, setUploadProgress);
        uploadedPath = uploaded.storagePath;

        await onCreate({
          title: title.trim(),
          description: description.trim(),
          tags,
          sourceType: "upload",
          fileType: uploaded.fileType,
          downloadUrl: uploaded.downloadUrl,
          storagePath: uploaded.storagePath,
          mimeType: uploaded.mimeType,
          sizeBytes: uploaded.sizeBytes,
        });
      }

      toast({ title: "Documento adicionado à Biblioteca Comercial" });
      onOpenChange(false);
    } catch (error) {
      // Sem metadado o arquivo não aparece na biblioteca: melhor removê-lo.
      if (uploadedPath) await deleteCommercialFile(uploadedPath);
      toast({
        title: "Falha ao salvar",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
      setUploadProgress(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-headline">
            {isEditing ? "Editar documento" : "Adicionar documento comercial"}
          </DialogTitle>
          <DialogDescription className="font-body">
            {mode === "source" &&
              "Envie o arquivo: a IA lê o conteúdo e escreve a descrição para você validar."}
            {mode === "interview" &&
              "Confirme ou corrija o que a IA deduziu. O que não se aplica pode ficar em branco — ou use “Pular perguntas”."}
            {mode === "review" &&
              "Validação final. É por estes metadados que a busca encontra o documento."}
          </DialogDescription>
        </DialogHeader>

        {/* Torna o fluxo visível: arquivo e descrição → perguntas → validação final. */}
        {!isEditing && (
          <ol className="flex items-center gap-2 font-body text-xs text-muted-foreground">
            {[
              { key: "source", label: "1. Arquivo e descrição" },
              { key: "interview", label: "2. Perguntas" },
              { key: "review", label: "3. Validação" },
            ].map((step) => (
              <li
                key={step.key}
                className={cn(
                  "rounded-full border px-2.5 py-1",
                  mode === step.key
                    ? "border-primary bg-primary/10 font-medium text-foreground"
                    : "border-transparent bg-muted"
                )}
              >
                {step.label}
              </li>
            ))}
          </ol>
        )}

        {mode === "source" && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                type="button"
                variant={sourceType === "upload" ? "default" : "outline"}
                size="sm"
                onClick={() => setSourceType("upload")}
                className="font-body"
              >
                <Upload className="mr-1.5 h-4 w-4" />
                Enviar arquivo
              </Button>
              <Button
                type="button"
                variant={sourceType === "link" ? "default" : "outline"}
                size="sm"
                onClick={() => setSourceType("link")}
                className="font-body"
              >
                <Paperclip className="mr-1.5 h-4 w-4" />
                Usar link do Drive
              </Button>
            </div>

            {sourceType === "upload" ? (
              <div className="space-y-2">
                <Label htmlFor="commercial-file" className="font-body">
                  Arquivo (PDF, PPT/PPTX, MP3, M4A ou WAV — até 100 MB)
                </Label>
                <Input
                  id="commercial-file"
                  type="file"
                  accept={UPLOAD_ACCEPT_ATTRIBUTE}
                  onChange={(event) => void handleFileChange(event.target.files?.[0])}
                  disabled={isReadingFile}
                  className="font-body"
                />
                {file && (
                  <p className="font-body text-sm text-muted-foreground">Selecionado: {file.name}</p>
                )}
                {isReadingFile && (
                  <p className="flex items-center gap-1.5 font-body text-sm text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Lendo o conteúdo do arquivo…
                  </p>
                )}
                {/* Diz de onde saiu (ou por que não saiu) a descrição sugerida. */}
                {!isReadingFile && extraction && (
                  <p className="font-body text-sm text-muted-foreground">
                    {extraction.source === "none"
                      ? `Não consegui ler o conteúdo. ${extraction.note ?? ""} Descreva o material abaixo.`
                      : `Conteúdo lido${extraction.note ? ` — ${extraction.note}` : ""}. Revise a descrição sugerida.`}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="commercial-link" className="font-body">
                    Link (https)
                  </Label>
                  <Input
                    id="commercial-link"
                    type="url"
                    placeholder="https://drive.google.com/..."
                    value={linkUrl}
                    onChange={(event) => setLinkUrl(event.target.value)}
                    className="font-body"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-body">Tipo do material</Label>
                  <div className="flex flex-wrap gap-2">
                    {LINK_FILE_TYPES.map((option) => (
                      <Button
                        key={option.value}
                        type="button"
                        variant={linkFileType === option.value ? "default" : "outline"}
                        size="sm"
                        onClick={() => setLinkFileType(option.value)}
                        className="font-body"
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="commercial-brief" className="font-body">
                {hasDraftDescription ? "Descrição sugerida — valide ou edite" : "Descrição breve"}
              </Label>
              <Textarea
                id="commercial-brief"
                rows={3}
                placeholder="Ex.: lâmina do fundo de crédito privado para clientes conservadores"
                value={briefDescription}
                onChange={(event) => setBriefDescription(event.target.value)}
                className="font-body"
              />
              {hasDraftDescription && (
                <p className="flex items-center gap-1.5 font-body text-xs text-muted-foreground">
                  <Sparkles className="h-3 w-3 text-primary" />
                  Escrita a partir do conteúdo do arquivo. É ela que orienta as próximas
                  perguntas — ajuste antes de seguir.
                </p>
              )}
            </div>
          </div>
        )}

        {mode === "interview" && (
          <div className="space-y-4">
            {questions.map((item, index) => {
              const hasSuggestion = !!item.suggestedAnswer;
              const isUnchanged = hasSuggestion && answers[index] === item.suggestedAnswer;

              return (
                <div key={item.question} className="space-y-2">
                  <Label htmlFor={`assistant-answer-${index}`} className="font-body">
                    {item.question}{" "}
                    <span className="font-normal text-muted-foreground">(opcional)</span>
                  </Label>
                  <Input
                    id={`assistant-answer-${index}`}
                    value={answers[index] ?? ""}
                    onChange={(event) => {
                      const next = [...answers];
                      next[index] = event.target.value;
                      setAnswers(next);
                    }}
                    placeholder="Deixe em branco se não se aplica"
                    className="font-body"
                  />
                  {/* Sugestão intacta merece conferência: ela veio do arquivo, não de você. */}
                  {isUnchanged && (
                    <p className="flex items-center gap-1.5 font-body text-xs text-muted-foreground">
                      <Sparkles className="h-3 w-3 text-primary" />
                      Sugerido a partir do conteúdo do arquivo — confirme ou corrija.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {mode === "review" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="commercial-title" className="font-body">
                Título
              </Label>
              <Input
                id="commercial-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="font-body"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="commercial-description" className="font-body">
                Descrição
              </Label>
              <Textarea
                id="commercial-description"
                rows={5}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="font-body"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="commercial-tags" className="font-body">
                Tags
              </Label>
              <div className="flex gap-2">
                <Input
                  id="commercial-tags"
                  value={tagInput}
                  onChange={(event) => setTagInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addTag();
                    }
                  }}
                  placeholder="Digite e pressione Enter"
                  className="font-body"
                />
                <Button type="button" variant="outline" onClick={addTag} className="font-body">
                  Adicionar
                </Button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="font-body">
                      {tag}
                      <button
                        type="button"
                        onClick={() => setTags((current) => current.filter((item) => item !== tag))}
                        aria-label={`Remover tag ${tag}`}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {uploadProgress !== null && (
              <div className="space-y-1">
                <Progress value={uploadProgress} />
                <p className="font-body text-xs text-muted-foreground">
                  Enviando arquivo… {uploadProgress}%
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {mode === "source" && (
            <Button
              type="button"
              onClick={() => void runAssistant([], 0)}
              disabled={!canStartAssistant || isThinking}
              className="font-body"
            >
              {isThinking ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-1.5 h-4 w-4" />
              )}
              Continuar com o assistente
            </Button>
          )}

          {mode === "interview" && (
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={handleSkipQuestions}
                disabled={isThinking}
                className="font-body"
              >
                <SkipForward className="mr-1.5 h-4 w-4" />
                Pular perguntas
              </Button>
              <Button
                type="button"
                onClick={handleSubmitAnswers}
                disabled={isThinking}
                className="font-body"
              >
                {isThinking ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-1.5 h-4 w-4" />
                )}
                Gerar metadados
              </Button>
            </>
          )}

          {mode === "review" && (
            <Button type="button" onClick={handleSave} disabled={isSaving} className="font-body">
              {isSaving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {isEditing ? "Salvar alterações" : "Publicar na biblioteca"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
