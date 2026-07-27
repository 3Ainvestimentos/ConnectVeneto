"use client";

import React from "react";
import { getIcon } from "@/lib/icons";
import {
  SolicitationArea,
  SolicitationItem,
  SolicitationItemExternal,
  SolicitationItemInfo,
  venetoSolicitacoesAreas,
} from "@/config/veneto-solicitacoes";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Link2, Info, Search, ChevronRight } from "lucide-react";
import Image from "next/image";

function trackSolicitacaoEvent(eventName: string, payload: Record<string, string>) {
  if (typeof window === "undefined") return;
  if (process.env.NODE_ENV !== "production") {
    // Telemetria minima para depuracao local.
    console.info(`[solicitacoes] ${eventName}`, payload);
  }
}

function isInfoItem(item: SolicitationItem): item is SolicitationItemInfo {
  return item.kind === "info";
}

function linkTarget(item: SolicitationItemExternal): "_blank" | undefined {
  if (item.newTab === false) return undefined;
  if (item.newTab === true) return "_blank";
  return item.href.startsWith("mailto:") ? undefined : "_blank";
}

function linkRel(item: SolicitationItemExternal): string | undefined {
  return linkTarget(item) === "_blank" ? "noopener noreferrer" : undefined;
}

function SolicitationTile({
  item,
  onInfoClick,
  areaId,
}: {
  item: SolicitationItem;
  onInfoClick: (item: SolicitationItemInfo) => void;
  areaId: string;
}) {
  const info = isInfoItem(item);
  const badgeClass = info
    ? "bg-muted text-muted-foreground"
    : "bg-[#0d1d2c]/10 text-[#0d1d2c]";
  const Icon = info ? Info : Link2;

  const inner = (
    <>
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${badgeClass}`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
        {item.subtitle && (
          <p className="truncate text-xs text-muted-foreground">{item.subtitle}</p>
        )}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </>
  );

  const className =
    "group flex w-full items-center gap-3 rounded-lg border border-border bg-card p-3 text-left transition-all hover:border-[#0d1d2c]/40 hover:bg-muted/40 hover:shadow-sm";

  if (info) {
    return (
      <button
        type="button"
        className={className}
        onClick={() => {
          trackSolicitacaoEvent("info_open", {
            areaId,
            itemKey: item.trackingKey || item.title,
          });
          onInfoClick(item);
        }}
      >
        {inner}
      </button>
    );
  }

  return (
    <a
      href={item.href}
      target={linkTarget(item)}
      rel={linkRel(item)}
      className={className}
      onClick={() =>
        trackSolicitacaoEvent("subitem_click", {
          areaId,
          itemKey: item.trackingKey || item.title,
          hrefType: item.href.startsWith("mailto:") ? "mailto" : "external",
        })
      }
    >
      {inner}
    </a>
  );
}

export default function VenetoSolicitacoesHub() {
  const [activeArea, setActiveArea] = React.useState<SolicitationArea | null>(null);
  const [activeInfo, setActiveInfo] = React.useState<SolicitationItemInfo | null>(null);
  const [searchTerm, setSearchTerm] = React.useState("");

  const sortedAreas = React.useMemo(() => venetoSolicitacoesAreas, []);

  const query = searchTerm.trim().toLowerCase();

  const searchResults = React.useMemo(() => {
    if (!query) return [];
    return sortedAreas
      .map((area) => ({
        area,
        items: area.items.filter(
          (item) =>
            item.title.toLowerCase().includes(query) ||
            item.subtitle?.toLowerCase().includes(query)
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [sortedAreas, query]);

  return (
    <>
      <div className="relative mx-auto mb-6 w-full max-w-7xl">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Pesquisar formulario, documento ou assunto..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
          aria-label="Pesquisar solicitacoes"
        />
      </div>

      {query ? (
        <div className="mx-auto w-full max-w-7xl space-y-6">
          {searchResults.length > 0 ? (
            searchResults.map(({ area, items }) => {
              const Icon = getIcon(area.icon);
              return (
                <div key={area.id}>
                  <div className="mb-2 flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold text-foreground">{area.title}</h3>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {items.map((item, idx) => (
                      <SolicitationTile
                        key={`${item.title}-${idx}`}
                        item={item}
                        onInfoClick={setActiveInfo}
                        areaId={area.id}
                      />
                    ))}
                  </div>
                </div>
              );
            })
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Nenhum resultado para &quot;{searchTerm.trim()}&quot;.
            </p>
          )}
        </div>
      ) : (
        <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {sortedAreas.map((area) => {
            const Icon = getIcon(area.icon);
            return (
              <button
                key={area.id}
                type="button"
                className="w-full min-w-0 text-left"
                onClick={() => {
                  trackSolicitacaoEvent("area_open", {
                    areaId: area.id,
                    areaKey: area.trackingKey || area.title,
                  });
                  setActiveArea(area);
                }}
              >
                <Card className="h-32 w-full hover:bg-muted/50 transition-colors">
                  <CardContent className="h-full p-4 flex flex-col items-center justify-center text-center">
                    <Icon className="mb-2 h-7 w-7 text-muted-foreground" />
                    <span className="font-semibold text-sm">{area.title}</span>
                  </CardContent>
                </Card>
              </button>
            );
          })}
        </div>
      )}

      <Dialog
        open={!!activeArea}
        onOpenChange={(open) => {
          if (!open) {
            setActiveArea(null);
          }
        }}
      >
        <DialogContent className="max-h-[92vh] overflow-hidden p-0 sm:max-w-3xl">
          {activeArea && (
            <>
              <DialogHeader className="px-6 pt-6 pb-2">
                <DialogTitle className="text-2xl">{activeArea.title}</DialogTitle>
                <DialogDescription>
                  Selecione um item para abrir formulario, documento ou material de apoio.
                </DialogDescription>
              </DialogHeader>

              <ScrollArea className="h-[calc(92vh-110px)] px-6 pb-6 pr-4">
                <div className="space-y-4 pt-1">
                  {activeArea.showSlaImage && activeArea.slaImageSrc && (
                    <div className="rounded-md border p-3 space-y-2">
                      <div className="overflow-x-auto">
                        <Image
                          src={activeArea.slaImageSrc}
                          alt={activeArea.slaImageAlt || "SLAs da area"}
                          width={1200}
                          height={760}
                          className="h-auto min-w-[640px] w-full rounded-sm"
                        />
                      </div>
                      {activeArea.slaImageCaption && (
                        <p className="text-xs text-muted-foreground">{activeArea.slaImageCaption}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-3">
                        <a
                          href={activeArea.slaImageSrc}
                          download
                          className="inline-flex text-xs text-[#0d1d2c] hover:underline"
                        >
                          Baixar imagem
                        </a>
                        <a
                          href={activeArea.slaImageSrc}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex text-xs text-[#0d1d2c] hover:underline"
                        >
                          Abrir SLA em tela cheia
                        </a>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-3 py-1 pr-1 sm:grid-cols-2">
                    {activeArea.items.map((item, idx) => (
                      <SolicitationTile
                        key={`${item.title}-${idx}`}
                        item={item}
                        onInfoClick={setActiveInfo}
                        areaId={activeArea.id}
                      />
                    ))}
                  </div>
                </div>
              </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!activeInfo}
        onOpenChange={(open) => {
          if (!open) setActiveInfo(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          {activeInfo && (
            <>
              <DialogHeader>
                <DialogTitle>{activeInfo.title}</DialogTitle>
                <DialogDescription>
                  Informacao adicional para esta solicitacao.
                </DialogDescription>
              </DialogHeader>
              <div className="text-sm whitespace-pre-line text-muted-foreground">
                {activeInfo.infoText}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
