
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// Mock data removed. This component would need to be wired up to a data source (like a context) to be useful.
type CarouselNewsItem = {
  title: string;
  imageUrl: string;
  dataAiHint?: string;
  category: string;
  description: string;
  date: string;
};
const newsItems: CarouselNewsItem[] = [];

export default function NewsCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);

  const nextSlide = useCallback(() => {
    if (newsItems.length === 0) return;
    setCurrentIndex((prevIndex) => (prevIndex + 1) % newsItems.length);
  }, []);

  const prevSlide = () => {
    if (newsItems.length === 0) return;
    setCurrentIndex((prevIndex) => (prevIndex - 1 + newsItems.length) % newsItems.length);
  };

  useEffect(() => {
    const interval = setInterval(nextSlide, 7000); // Auto-scroll every 7 seconds
    return () => clearInterval(interval);
  }, [nextSlide]);

  if (newsItems.length === 0) {
    return null; // Or a placeholder
  }

  const currentItem = newsItems[currentIndex];

  return (
    <Card className="overflow-hidden shadow-md relative group">
      <div className="relative w-full h-64 md:h-80">
        <Image
          src={currentItem.imageUrl}
          alt={currentItem.title}
          layout="fill"
          objectFit="cover"
          className="transition-transform duration-500 ease-in-out group-hover:scale-105"
          data-ai-hint={currentItem.dataAiHint}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
        <Badge variant="secondary" className="mb-2 bg-accent text-accent-foreground font-body">{currentItem.category}</Badge>
        <h3 className="text-2xl font-headline font-bold mb-1">{currentItem.title}</h3>
        <p className="text-sm text-gray-200 mb-2 font-body">{currentItem.description}</p>
        <p className="text-xs text-gray-300 font-body">{currentItem.date}</p>
      </div>

      <Button
        variant="outline"
        size="icon"
        className="absolute left-4 top-1/2 -translate-y-1/2 bg-background/50 hover:bg-background/80 text-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-full backdrop-blur-sm"
        onClick={prevSlide}
        aria-label="Notícia Anterior"
      >
        <ChevronLeft className="h-6 w-6" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        className="absolute right-4 top-1/2 -translate-y-1/2 bg-background/50 hover:bg-background/80 text-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-full backdrop-blur-sm"
        onClick={nextSlide}
        aria-label="Próxima Notícia"
      >
        <ChevronRight className="h-6 w-6" />
      </Button>
      
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex space-x-2">
        {newsItems.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentIndex(index)}
            aria-label={`Ir para notícia ${index + 1}`}
            className={`h-2 w-2 rounded-full transition-all duration-300 ${currentIndex === index ? 'bg-white w-4' : 'bg-white/50 hover:bg-white/75'}`}
          />
        ))}
      </div>
    </Card>
  );
}
