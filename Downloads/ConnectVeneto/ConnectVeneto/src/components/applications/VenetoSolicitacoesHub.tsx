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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink, Link2, Info } from "lucide-react";
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

function ItemCard({
  item,
  onInfoClick,
  areaId,
}: {
  item: SolicitationItem;
  onInfoClick: (item: SolicitationItemInfo) => void;
  areaId: string;
}) {
  if (isInfoItem(item)) {
    return (
      <button
        type="button"
        className="w-full text-left"
        onClick={() => {
          trackSolicitacaoEvent("info_open", {
            areaId,
            itemKey: item.trackingKey || item.title,
          });
          onInfoClick(item);
        }}
      >
        <Card className="hover:bg-muted/50 transition-colors">
          <CardContent className="p-4 flex items-start gap-3">
            <Info className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-sm">{item.title}</p>
              {item.subtitle && (
                <p className="text-xs text-muted-foreground">{item.subtitle}</p>
              )}
              {item.description && (
                <p className="text-xs text-muted-foreground">{item.description}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </button>
    );
  }

  const target = linkTarget(item);
  const rel = linkRel(item);

  return (
    <a
      href={item.href}
      target={target}
      rel={rel}
      className="block"
      onClick={() =>
        trackSolicitacaoEvent("subitem_click", {
          areaId,
          itemKey: item.trackingKey || item.title,
          hrefType: item.href.startsWith("mailto:") ? "mailto" : "external",
        })
      }
    >
      <Card className="hover:bg-muted/50 transition-colors">
        <CardContent className="p-4 flex items-start gap-3">
          <Link2 className="h-5 w-5 text-muted-foreground mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-sm">{item.title}</p>
            {item.subtitle && (
              <p className="text-xs text-muted-foreground">{item.subtitle}</p>
            )}
            {item.description && (
              <p className="text-xs text-muted-foreground">{item.description}</p>
            )}
          </div>
        </CardContent>
      </Card>
    </a>
  );
}

function WealthPill({
  item,
  onInfoClick,
  areaId,
}: {
  item: SolicitationItem;
  onInfoClick: (item: SolicitationItemInfo) => void;
  areaId: string;
}) {
  const isPrimary = item.pillVariant === "primary";
  const baseClass =
    "inline-flex w-full items-center justify-center rounded-full border px-4 py-2 text-[11px] sm:text-xs font-semibold uppercase tracking-wide transition-colors";
  const visualClass = isPrimary
    ? "border-[#0d1d2c] bg-[#0d1d2c] text-white hover:bg-[#132c41]"
    : "border-[#0d1d2c] bg-white text-[#0d1d2c] hover:bg-slate-50";

  if (isInfoItem(item)) {
    const specialPositionClass = isPrimary
      ? "sm:col-span-2 sm:w-[70%] sm:justify-self-center xl:col-span-2 xl:col-start-2 xl:w-full"
      : "";

    return (
      <button
        type="button"
        className={`${baseClass} ${visualClass} ${specialPositionClass}`.trim()}
        onClick={() => {
          trackSolicitacaoEvent("info_open", {
            areaId,
            itemKey: item.trackingKey || item.title,
          });
          onInfoClick(item);
        }}
      >
        {item.title}
      </button>
    );
  }

  return (
    <a
      href={item.href}
      target={linkTarget(item)}
      rel={linkRel(item)}
      className={`${baseClass} ${visualClass}`.trim()}
      onClick={() =>
        trackSolicitacaoEvent("subitem_click", {
          areaId,
          itemKey: item.trackingKey || item.title,
          hrefType: item.href.startsWith("mailto:") ? "mailto" : "external",
        })
      }
    >
      {item.title}
    </a>
  );
}

export default function VenetoSolicitacoesHub() {
  const [activeArea, setActiveArea] = React.useState<SolicitationArea | null>(null);
  const [activeInfo, setActiveInfo] = React.useState<SolicitationItemInfo | null>(null);

  const isWealthLayout = activeArea?.subitemsLayout === "pill-grid";

  const areaCardClassName =
    "w-full sm:w-[calc(50%-0.5rem)] lg:w-[calc(33.333%-0.75rem)] max-w-[280px]";

  const sortedAreas = React.useMemo(() => venetoSolicitacoesAreas, []);

  return (
    <>
      <div className="flex flex-wrap justify-center gap-4">
        {sortedAreas.map((area) => {
          const Icon = getIcon(area.icon);
          return (
            <button
              key={area.id}
              type="button"
              className={areaCardClassName}
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

      <Dialog
        open={!!activeArea}
        onOpenChange={(open) => {
          if (!open) {
            setActiveArea(null);
          }
        }}
      >
        <DialogContent className={isWealthLayout ? "sm:max-w-5xl" : "sm:max-w-3xl"}>
          {activeArea && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl">{activeArea.title}</DialogTitle>
                <DialogDescription>
                  Selecione um item para abrir formulario, documento ou material de apoio.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {activeArea.overviewUrl && (
                  <div>
                    <Button variant="outline" asChild>
                      <a
                        href={activeArea.overviewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() =>
                          trackSolicitacaoEvent("overview_click", {
                            areaId: activeArea.id,
                            areaKey: activeArea.trackingKey || activeArea.title,
                          })
                        }
                      >
                        Pagina da area <ExternalLink className="ml-2 h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                )}

                {activeArea.showSlaImage && activeArea.slaImageSrc && (
                  <div className="rounded-md border p-3 space-y-2">
                    <Image
                      src={activeArea.slaImageSrc}
                      alt={activeArea.slaImageAlt || "SLAs da area"}
                      width={1200}
                      height={760}
                      className="w-full h-auto rounded-sm"
                    />
                    {activeArea.slaImageCaption && (
                      <p className="text-xs text-muted-foreground">{activeArea.slaImageCaption}</p>
                    )}
                    <a
                      href={activeArea.slaImageSrc}
                      download
                      className="inline-flex text-xs text-[#0d1d2c] hover:underline"
                    >
                      Baixar imagem
                    </a>
                  </div>
                )}

                <ScrollArea className="max-h-[58vh] pr-2">
                  {isWealthLayout ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 py-1">
                      {activeArea.items.map((item, idx) => (
                        <WealthPill
                          key={`${item.title}-${idx}`}
                          item={item}
                          onInfoClick={setActiveInfo}
                          areaId={activeArea.id}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-3 py-1">
                      {activeArea.items.map((item, idx) => (
                        <ItemCard
                          key={`${item.title}-${idx}`}
                          item={item}
                          onInfoClick={setActiveInfo}
                          areaId={activeArea.id}
                        />
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
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
