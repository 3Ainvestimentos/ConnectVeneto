"use client";

import { useState } from "react";

export type Highlight = {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  link: string;
  dataAiHint?: string;
  isActive: boolean;
};

export function useHighlights() {
  const [highlights, setHighlights] = useState<Highlight[]>([]);

  const addHighlight = (data: Omit<Highlight, "id" | "isActive">) => {
    const newItem: Highlight = {
      ...data,
      id: crypto.randomUUID(),
      isActive: false,
    };
    setHighlights((prev) => [...prev, newItem]);
  };

  const updateHighlight = (item: Highlight) => {
    setHighlights((prev) => prev.map((h) => (h.id === item.id ? item : h)));
  };

  const deleteHighlight = (id: string) => {
    setHighlights((prev) => prev.filter((h) => h.id !== id));
  };

  const toggleHighlightActive = (id: string) => {
    setHighlights((prev) =>
      prev.map((h) => (h.id === id ? { ...h, isActive: !h.isActive } : h))
    );
  };

  return {
    highlights,
    addHighlight,
    updateHighlight,
    deleteHighlight,
    toggleHighlightActive,
  };
}

