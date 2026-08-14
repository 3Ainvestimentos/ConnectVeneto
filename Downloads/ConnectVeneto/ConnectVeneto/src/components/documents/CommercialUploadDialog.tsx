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
import {
  UPLOAD_ACCEPT_ATTRIBUTE,
  type CommercialDocument,
  type CommercialFileType,
} from "@/config/biblioteca-comercial";
import {
  deleteCommercialFile,
  uploadCommercialFile,
  validateCommercialFile,
} from "@/lib/biblioteca-comercial-storage";
import { useUploadAssistant, type AssistantAnswer } from "@/hooks/useUploadAssistant";
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
  const { ask, isThinking } = useUploadAssistant();

  const [mode, setMode] = useState<Mode>("source");
  const [sourceType, setSourceType] = useState<"upload" | "link">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkFileType, setLinkFileType] = useState<CommercialFileType>("pdf");
  const [briefDescription, setBriefDescription] = useState("");

  const [questions, setQuestions] = useState<string[]>([]);
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
    setQuestions([]);
    setAnswers([]);
    setPreviousAnswers([]);
    setRound(0);
    setTagInput("");
    setUploadProgress(null);
  }, [open, editing]);

  const effectiveFileName = file?.name ?? linkUrl;
  const effectiveFileType: CommercialFileType = sourceType === "link" ? linkFileType : "pdf";

  const canStartAssistant = useMemo(() => {
    if (briefDescription.trim().length < 3) return false;
    if (sourceType === "upload") return !!file;
    return /^https:\/\/\S+$/.test(linkUrl.trim());
  }, [briefDescription, sourceType, file, linkUrl]);

  const handleFileChange = (selected: File | undefined) => {
    if (!selected) return;
    const validationError = validateCommercialFile(selected);
    if (validationError) {
      toast({ title: "Arquivo não aceito", description: validationError, variant: "destructive" });
      return;
    }
    setFile(selected);
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
      setAnswers(new Array(result.questions.length).fill(""));
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
    ...questions.map((question, index) => ({ question, answer: answers[index] ?? "" })),
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
              "Envie o arquivo ou cole o link e descreva brevemente o material. O assistente de IA completa o resto."}
            {mode === "interview" &&
              "Responda só o que fizer sentido. Se as perguntas não se aplicam a este material, use “Pular perguntas”."}
            {mode === "review" &&
              "Revise os metadados. É por eles que o chat encontra este documento."}
          </DialogDescription>
        </DialogHeader>

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
                  onChange={(event) => handleFileChange(event.target.files?.[0])}
                  className="font-body"
                />
                {file && (
                  <p className="font-body text-sm text-muted-foreground">Selecionado: {file.name}</p>
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
                Descrição breve
              </Label>
              <Textarea
                id="commercial-brief"
                rows={3}
                placeholder="Ex.: lâmina do fundo de crédito privado para clientes conservadores"
                value={briefDescription}
                onChange={(event) => setBriefDescription(event.target.value)}
                className="font-body"
              />
            </div>
          </div>
        )}

        {mode === "interview" && (
          <div className="space-y-4">
            {questions.map((question, index) => (
              <div key={question} className="space-y-2">
                <Label htmlFor={`assistant-answer-${index}`} className="font-body">
                  {question}{" "}
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
              </div>
            ))}
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
