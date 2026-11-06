"use client";

import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSolicitacoesConfig } from "@/hooks/useSolicitacoesConfig";
import {
  SolicitationArea,
  SolicitationItem,
  venetoSolicitacoesAreas,
} from "@/config/veneto-solicitacoes";
import { getIcon } from "@/lib/icons";
import { iconList } from "@/lib/icon-list";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Badge } from "../ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { toast } from "@/hooks/use-toast";
import {
  ArrowDown,
  ArrowUp,
  Loader2,
  PlusCircle,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import { isValidSolicitationHref } from "@/lib/solicitacoes-href";

const cloneAreas = (areas: SolicitationArea[]): SolicitationArea[] =>
  JSON.parse(JSON.stringify(areas));

function moveInList<T>(list: T[], index: number, delta: number): T[] {
  const target = index + delta;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/** Primeiro problema encontrado, para o toast. Nulo quando está tudo certo. */
function findValidationError(areas: SolicitationArea[]): string | null {
  for (const area of areas) {
    if (!area.title.trim()) return "Há uma área sem nome.";
    for (const item of area.items) {
      if (!item.title.trim()) return `Há um item sem nome em "${area.title}".`;
      if (item.kind === "external" && !isValidSolicitationHref(item.href)) {
        return `O link de "${item.title}" (${area.title}) precisa ser https://, mailto: ou um caminho do Connect (ex.: /formularios-cadastro).`;
      }
      if (item.kind === "info" && !item.infoText.trim()) {
        return `O texto informativo de "${item.title}" (${area.title}) está vazio.`;
      }
    }
  }
  return null;
}

function formatUpdatedAt(iso?: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function ManageSolicitacoes() {
  const { isSuperAdmin } = useAuth();
  const { areas, isCustomized, updatedAt, updatedBy, loading, saveAreas, saving } =
    useSolicitacoesConfig();

  const [draft, setDraft] = React.useState<SolicitationArea[]>(() => cloneAreas(areas));
  const [dirty, setDirty] = React.useState(false);
  const [openAreas, setOpenAreas] = React.useState<string[]>([]);

  // Recarrega o rascunho quando a versão salva muda, mas não por cima de edição em andamento.
  React.useEffect(() => {
    if (!dirty) setDraft(cloneAreas(areas));
  }, [areas, dirty]);

  const readOnly = !isSuperAdmin;

  const updateDraft = (updater: (current: SolicitationArea[]) => SolicitationArea[]) => {
    setDraft((current) => updater(current));
    setDirty(true);
  };

  const updateArea = (areaIndex: number, patch: Partial<SolicitationArea>) =>
    updateDraft((current) =>
      current.map((area, i) => (i === areaIndex ? { ...area, ...patch } : area))
    );

  const updateItem = (areaIndex: number, itemIndex: number, next: SolicitationItem) =>
    updateDraft((current) =>
      current.map((area, i) =>
        i === areaIndex
          ? { ...area, items: area.items.map((item, j) => (j === itemIndex ? next : item)) }
          : area
      )
    );

  const setItems = (areaIndex: number, items: SolicitationItem[]) =>
    updateArea(areaIndex, { items });

  const changeItemKind = (areaIndex: number, itemIndex: number, kind: SolicitationItem["kind"]) => {
    const item = draft[areaIndex].items[itemIndex];
    if (item.kind === kind) return;
    const base = {
      title: item.title,
      subtitle: item.subtitle,
      description: item.description,
      trackingKey: item.trackingKey,
    };
    updateItem(
      areaIndex,
      itemIndex,
      kind === "external" ? { ...base, kind, href: "" } : { ...base, kind, infoText: "" }
    );
  };

  const addArea = () => {
    const id = `area-${Date.now()}`;
    updateDraft((current) => [
      ...current,
      { id, title: "Nova área", icon: "LayoutGrid", items: [] },
    ]);
    setOpenAreas((current) => [...current, id]);
  };

  const removeArea = (areaIndex: number) => {
    const area = draft[areaIndex];
    if (!window.confirm(`Excluir a área "${area.title}" e seus ${area.items.length} itens?`)) return;
    updateDraft((current) => current.filter((_, i) => i !== areaIndex));
  };

  const removeItem = (areaIndex: number, itemIndex: number) => {
    const item = draft[areaIndex].items[itemIndex];
    if (!window.confirm(`Excluir o item "${item.title || "sem nome"}"?`)) return;
    setItems(areaIndex, draft[areaIndex].items.filter((_, j) => j !== itemIndex));
  };

  const handleDiscard = () => {
    setDraft(cloneAreas(areas));
    setDirty(false);
  };

  const handleRestoreDefault = () => {
    if (!window.confirm("Substituir o rascunho pela lista padrão original? Nada é salvo até clicar em Salvar.")) return;
    setDraft(cloneAreas(venetoSolicitacoesAreas));
    setDirty(true);
  };

  const handleSave = async () => {
    const error = findValidationError(draft);
    if (error) {
      toast({ title: "Revise antes de salvar", description: error, variant: "destructive" });
      return;
    }
    const trimmed = draft.map((area) => ({
      ...area,
      title: area.title.trim(),
      items: area.items.map((item) =>
        item.kind === "external"
          ? { ...item, title: item.title.trim(), subtitle: item.subtitle?.trim() || undefined, href: item.href.trim() }
          : { ...item, title: item.title.trim(), subtitle: item.subtitle?.trim() || undefined }
      ),
    }));
    try {
      await saveAreas(trimmed);
      setDirty(false);
      toast({ title: "Solicitações atualizadas", description: "A página Solicitações já mostra a nova versão." });
    } catch (err) {
      toast({
        title: "Erro ao salvar",
        description: err instanceof Error ? err.message : "Não foi possível salvar.",
        variant: "destructive",
      });
    }
  };

  const lastUpdate = formatUpdatedAt(updatedAt);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <CardTitle>Gerenciar Solicitações</CardTitle>
          <CardDescription>
            Edite as áreas e os links exibidos na página Solicitações. As mudanças só valem depois de salvar.
          </CardDescription>
          <p className="text-xs text-muted-foreground">
            {loading
              ? "Carregando…"
              : isCustomized
                ? `Última alteração${lastUpdate ? ` em ${lastUpdate}` : ""}${updatedBy ? ` por ${updatedBy}` : ""}.`
                : "Ainda usando a lista padrão. O primeiro salvamento passa a valer no lugar dela."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {dirty && (
            <Button variant="outline" onClick={handleDiscard} disabled={saving}>
              Descartar
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={readOnly || !dirty || saving}
            title={readOnly ? "Requer super administrador" : undefined}
            className="bg-admin-primary hover:bg-admin-primary/90"
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar alterações
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {dirty && (
          <Badge variant="outline" className="border-amber-500/60 bg-amber-500/10 text-amber-700">
            Alterações não salvas
          </Badge>
        )}

        <Accordion type="multiple" value={openAreas} onValueChange={setOpenAreas} className="rounded-lg border">
          {draft.map((area, areaIndex) => {
            const Icon = getIcon(area.icon);
            return (
              <AccordionItem key={area.id} value={area.id} className="px-4 last:border-b-0">
                <AccordionTrigger className="hover:no-underline">
                  <span className="flex items-center gap-3">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{area.title || "Sem nome"}</span>
                    <Badge variant="secondary">{area.items.length} itens</Badge>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-[1fr_200px_auto] sm:items-end">
                    <div>
                      <Label htmlFor={`area-title-${area.id}`}>Nome da área</Label>
                      <Input
                        id={`area-title-${area.id}`}
                        value={area.title}
                        onChange={(e) => updateArea(areaIndex, { title: e.target.value })}
                        aria-invalid={!area.title.trim()}
                        className={!area.title.trim() ? "border-destructive" : undefined}
                        disabled={readOnly}
                      />
                    </div>
                    <div>
                      <Label>Ícone</Label>
                      <Select
                        value={area.icon}
                        onValueChange={(icon) => updateArea(areaIndex, { icon })}
                        disabled={readOnly}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="max-h-72">
                          {Array.from(new Set([area.icon, ...iconList])).map((name) => {
                            const OptionIcon = getIcon(name);
                            return (
                              <SelectItem key={name} value={name}>
                                <span className="flex items-center gap-2">
                                  <OptionIcon className="h-4 w-4" />
                                  {name}
                                </span>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Mover área para cima"
                        onClick={() => updateDraft((current) => moveInList(current, areaIndex, -1))}
                        disabled={readOnly || areaIndex === 0}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Mover área para baixo"
                        onClick={() => updateDraft((current) => moveInList(current, areaIndex, 1))}
                        disabled={readOnly || areaIndex === draft.length - 1}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Excluir área"
                        onClick={() => removeArea(areaIndex)}
                        disabled={readOnly}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {area.items.map((item, itemIndex) => {
                      const titleInvalid = !item.title.trim();
                      const hrefInvalid = item.kind === "external" && !isValidSolicitationHref(item.href);
                      return (
                        <div key={itemIndex} className="space-y-3 rounded-md border bg-muted/30 p-3">
                          <div className="grid gap-3 sm:grid-cols-[140px_1fr_1fr_auto] sm:items-end">
                            <div>
                              <Label>Tipo</Label>
                              <Select
                                value={item.kind}
                                onValueChange={(kind) =>
                                  changeItemKind(areaIndex, itemIndex, kind as SolicitationItem["kind"])
                                }
                                disabled={readOnly}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="external">Link</SelectItem>
                                  <SelectItem value="info">Informativo</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label>Nome</Label>
                              <Input
                                value={item.title}
                                onChange={(e) =>
                                  updateItem(areaIndex, itemIndex, { ...item, title: e.target.value })
                                }
                                aria-invalid={titleInvalid}
                                className={titleInvalid ? "border-destructive" : undefined}
                                disabled={readOnly}
                              />
                            </div>
                            <div>
                              <Label>Subtítulo (opcional)</Label>
                              <Input
                                value={item.subtitle ?? ""}
                                onChange={(e) =>
                                  updateItem(areaIndex, itemIndex, { ...item, subtitle: e.target.value })
                                }
                                disabled={readOnly}
                              />
                            </div>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Mover item para cima"
                                onClick={() => setItems(areaIndex, moveInList(area.items, itemIndex, -1))}
                                disabled={readOnly || itemIndex === 0}
                              >
                                <ArrowUp className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Mover item para baixo"
                                onClick={() => setItems(areaIndex, moveInList(area.items, itemIndex, 1))}
                                disabled={readOnly || itemIndex === area.items.length - 1}
                              >
                                <ArrowDown className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Excluir item"
                                onClick={() => removeItem(areaIndex, itemIndex)}
                                disabled={readOnly}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                          {item.kind === "external" ? (
                            <div>
                              <Label>Link</Label>
                              <Input
                                value={item.href}
                                placeholder="https://... ou /formularios-cadastro"
                                onChange={(e) =>
                                  updateItem(areaIndex, itemIndex, { ...item, href: e.target.value })
                                }
                                aria-invalid={hrefInvalid}
                                className={hrefInvalid ? "border-destructive" : undefined}
                                disabled={readOnly}
                              />
                            </div>
                          ) : (
                            <div>
                              <Label>Texto exibido ao clicar</Label>
                              <Textarea
                                value={item.infoText}
                                rows={4}
                                onChange={(e) =>
                                  updateItem(areaIndex, itemIndex, { ...item, infoText: e.target.value })
                                }
                                disabled={readOnly}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setItems(areaIndex, [...area.items, { kind: "external", title: "", href: "" }])
                      }
                      disabled={readOnly}
                    >
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Adicionar item
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>

        <div className="flex flex-wrap justify-between gap-2">
          <Button variant="outline" onClick={addArea} disabled={readOnly}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Adicionar área
          </Button>
          <Button variant="ghost" onClick={handleRestoreDefault} disabled={readOnly}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Restaurar lista padrão
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
