"use client";

import React from "react";
import { venetoAreaLogadaCards } from "@/config/veneto-area-logada";

export default function VenetoAreaLogadaCards() {
  return (
    <div className="mx-auto grid w-full max-w-4xl grid-cols-1 gap-6 md:grid-cols-3 md:gap-6">
      {venetoAreaLogadaCards.map((card) => (
        <div
          key={card.id}
          className="relative flex min-h-[300px] flex-col items-center justify-center px-6 py-10 text-center shadow-none bg-[#F2F2F2] dark:bg-card text-[#0d1d2c] dark:text-card-foreground border border-transparent dark:border-border"
        >
          {/* O container principal centraliza o título e o botão verticalmente */}
          <div className="flex flex-col items-center justify-center gap-6">
            <h2 className="font-serif text-[22px] leading-tight font-bold tracking-tight">
              {card.title}
            </h2>
            <a
              href={card.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-w-[150px] items-center justify-center rounded-full border border-[#0d1d2c] dark:border-border bg-transparent px-6 py-2 text-[11px] font-semibold uppercase tracking-wider transition-colors hover:bg-[#0d1d2c]/5 dark:hover:bg-white/5"
            >
              Clique aqui
            </a>
          </div>

          {/* Se houver manual, ele fica preso absolutamente na base do card para não atrapalhar a centralização vertical do conteúdo acima */}
          {card.manualHref && card.manualLabel && (
            <div className="absolute bottom-6 left-0 right-0">
              <a
                href={card.manualHref}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-normal text-[#a9a9a8] dark:text-muted-foreground underline-offset-4 hover:underline"
              >
                {card.manualLabel}
              </a>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
