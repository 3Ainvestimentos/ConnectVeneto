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
import { Link2, Info } from "lucide-react";
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

  const sortedAreas = React.useMemo(() => venetoSolicitacoesAreas, []);

  return (
    <>
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

      <Dialog
        open={!!activeArea}
        onOpenChange={(open) => {
          if (!open) {
            setActiveArea(null);
          }
        }}
      >
        <DialogContent
          className={`max-h-[92vh] overflow-hidden p-0 ${
            isWealthLayout ? "sm:max-w-5xl" : "sm:max-w-3xl"
          }`}
        >
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

                  {isWealthLayout ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 py-1 pr-1">
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
                    <div className="space-y-3 py-1 pr-1">
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
