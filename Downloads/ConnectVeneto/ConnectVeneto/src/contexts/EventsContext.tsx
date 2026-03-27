"use client";

import { getCollaboratorUserId, type Collaborator } from "@/contexts/CollaboratorsContext";

export interface EventType {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  icon: string;
  recipientIds: string[];
}

const events: EventType[] = [];

export function useEvents() {
  const getEventRecipients = (
    event: EventType,
    collaborators: Collaborator[]
  ): Collaborator[] => {
    if (event.recipientIds.includes("all")) {
      return collaborators;
    }

    return collaborators.filter((c) => {
      const collaboratorId = getCollaboratorUserId(c);
      return collaboratorId ? event.recipientIds.includes(collaboratorId) : false;
    });
  };

  return {
    events,
    getEventRecipients,
  };
}

