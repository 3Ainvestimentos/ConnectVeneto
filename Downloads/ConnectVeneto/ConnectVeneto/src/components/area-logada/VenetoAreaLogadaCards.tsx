"use client";

import React from "react";
import { venetoAreaLogadaCards } from "@/config/veneto-area-logada";

const CARD_BG = "#F2F2F2";
const BRAND_NAVY = "#0d1d2c";

export default function VenetoAreaLogadaCards() {
  return (
    <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-6 md:grid-cols-3 md:gap-8">
      {venetoAreaLogadaCards.map((card) => (
        <div
          key={card.id}
          className="flex min-h-[300px] flex-col items-center px-8 py-10 text-center shadow-none"
          style={{ backgroundColor: CARD_BG, color: BRAND_NAVY }}
        >
          {/* Espaçador flexível superior para empurrar o conteúdo para o meio */}
          <div className="flex-1" />

          {/* Container do Título com altura mínima para acomodar quebra de linha */}
          <div className="flex min-h-[64px] items-end justify-center">
            <h2 className="font-serif text-xl font-bold tracking-tight md:text-2xl">
              {card.title}
            </h2>
          </div>

          {/* Espaçamento fixo entre título e botão */}
          <div className="h-8" />

          {/* Botão */}
          <div>
            <a
              href={card.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-w-[160px] items-center justify-center rounded-full border border-[#0d1d2c] bg-transparent px-8 py-2.5 text-xs font-medium uppercase tracking-wide transition-colors hover:bg-[#0d1d2c]/5"
            >
              Clique aqui
            </a>
          </div>

          {/* Container do link do manual - ou um espaçador vazio se não tiver manual */}
          <div className="mt-8 min-h-[20px]">
            {card.manualHref && card.manualLabel ? (
              <a
                href={card.manualHref}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-normal text-[#a9a9a8] underline-offset-4 hover:underline"
              >
                {card.manualLabel}
              </a>
            ) : null}
          </div>

          {/* Espaçador flexível inferior */}
          <div className="flex-1" />
        </div>
      ))}
    </div>
  );
}
