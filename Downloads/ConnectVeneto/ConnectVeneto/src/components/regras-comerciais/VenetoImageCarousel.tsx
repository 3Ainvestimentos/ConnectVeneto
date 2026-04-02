"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
  type CarouselApi,
} from "@/components/ui/carousel";
import { cn } from "@/lib/utils";
import type { RegrasComerciaisSlide } from "@/config/regras-comerciais-slides";

interface VenetoImageCarouselProps {
  slides: RegrasComerciaisSlide[];
  label: string;
}

export function VenetoImageCarousel({ slides, label }: VenetoImageCarouselProps) {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);

  const onSelect = useCallback((emblaApi: CarouselApi) => {
    if (!emblaApi) return;
    setCurrent(emblaApi.selectedScrollSnap());
  }, []);

  useEffect(() => {
    if (!api) return;
    onSelect(api);
    api.on("select", onSelect);
    api.on("reInit", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [api, onSelect]);

  return (
    <div className="w-full space-y-3">
      <Carousel
        setApi={setApi}
        opts={{ loop: false }}
        aria-label={label}
        className="w-full"
      >
        <CarouselContent>
          {slides.map((slide, index) => (
            <CarouselItem key={index}>
              <div className="flex items-center justify-center bg-white rounded-lg shadow-sm overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={slide.src}
                  alt={slide.alt}
                  className="w-full h-auto object-contain max-h-[480px]"
                  loading="lazy"
                />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>

        <CarouselPrevious
          className="-left-4 md:-left-5"
          aria-label="Slide anterior"
        />
        <CarouselNext
          className="-right-4 md:-right-5"
          aria-label="Próximo slide"
        />
      </Carousel>

      {slides.length > 1 && (
        <div
          role="tablist"
          aria-label={`Indicadores de slide: ${label}`}
          className="flex justify-center gap-2"
        >
          {slides.map((_, index) => (
            <button
              key={index}
              role="tab"
              aria-selected={index === current}
              aria-label={`Slide ${index + 1} de ${slides.length}`}
              onClick={() => api?.scrollTo(index)}
              className={cn(
                "w-2 h-2 rounded-full transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                index === current
                  ? "bg-[#e1ca5f] w-4"
                  : "bg-muted-foreground/40 hover:bg-muted-foreground/70"
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
