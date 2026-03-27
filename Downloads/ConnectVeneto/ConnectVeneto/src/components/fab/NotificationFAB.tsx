
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useMessages } from '@/contexts/MessagesContext';
import { useAuth } from '@/contexts/AuthContext';
import { getCollaboratorUserId, useCollaborators } from '@/contexts/CollaboratorsContext';
import { useRouter } from 'next/navigation';
import { useIdleFabMessages } from '@/contexts/IdleFabMessagesContext';
import { X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useFabMessages } from '@/contexts/FabMessagesContext';
import { parseISO } from 'date-fns';
import { findCollaboratorByEmail } from '@/lib/email-utils';


// --- Ícone do Bob ---
function BobIcon({ isAnimated }: { isAnimated: boolean }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 28" fill="none" className="h-9 w-9">
            <style>
            {`
                @keyframes lamp-on-off {
                0%, 25% { opacity: 1; }
                50% { opacity: 0.1; }
                50.01%, 75% { opacity: 0.1; }
                100% { opacity: 1; }
                }
                .animate-lamp {
                animation: lamp-on-off 2s infinite ease-in-out;
                }
            `}
            </style>
            <g className={cn(isAnimated && "animate-lamp")} transform="translate(0, 1.5)">
                <circle cx="12" cy="6.5" r="5.5" fill="#FFFFE0" opacity="0.3"/>
                <circle cx="12" cy="6.5" r="4.5" fill="#FFFFE0" opacity="0.5"/>
                <path d="M12 11.5C9.23858 11.5 7 9.26142 7 6.5C7 3.73858 9.23858 1.5 12 1.5C14.7614 1.5 17 3.73858 17 6.5C17 9.26142 14.7614 11.5 12 11.5Z" stroke="#374151" strokeWidth="0.75" fill="rgba(209, 213, 219, 0.3)"/>
                <path d="M10.5 7.5L11.25 5L12 7.5L12.75 5L13.5 7.5" stroke="#FFE066" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </g>
            <path d="M9.5 12.5 H14.5 V14.0 H9.5 Z" fill="#6B7280" stroke="#374151" strokeWidth="0.6"/>
            <path d="M9.5 14.0 C9.5 14.5 10 14.5 10.5 14.5 H13.5 C14 14.5 14.5 14.5 14.5 14.0 L14 13.75 H10 L9.5 14.0 Z" fill="#6B7280" stroke="#374151" strokeWidth="0.6"/>
            <line x1="9.5" y1="13.0" x2="14.5" y2="13.0" stroke="#4B5563" strokeWidth="0.5"/>
            <line x1="9.5" y1="13.5" x2="14.5" y2="13.5" stroke="#4B5563" strokeWidth="0.5"/>
            <rect x="4" y="14.5" width="16" height="8.5" rx="3.5" fill="#E5E7EB" stroke="#6B7280" strokeWidth="1"/>
            <rect x="2.5" y="16" width="2" height="5.5" rx="1.5" fill="#9CA3AF" stroke="#4B5563" strokeWidth="0.75"/>
            <rect x="19.5" y="16" width="2" height="5.5" rx="1.5" fill="#9CA3AF" stroke="#4B5563" strokeWidth="0.75"/>
            <circle cx="8.5" cy="18.75" r="1.8" fill="#DFB87F"/>
            <circle cx="8.0" cy="18.25" r="0.5" fill="#FFFFFF" opacity="0.9"/>
            <circle cx="15.5" cy="18.75" r="1.8" fill="#DFB87F"/>
            <circle cx="15.0" cy="18.25" r="0.5" fill="#FFFFFF" opacity="0.9"/>
        </svg>
    );
}

// --- Componente do Balão de Diálogo ---
interface MessageBubbleProps {
  children: React.ReactNode;
  onClick?: () => void;
  onClose?: (e: React.MouseEvent) => void;
  hasCloseButton?: boolean;
  variant?: 'primary' | 'secondary';
  className?: string;
}

const MessageBubble = ({ children, onClick, onClose, hasCloseButton, variant = 'primary', className }: MessageBubbleProps) => {
    const bubbleColor = 'hsl(170, 60%, 50%)';
    const borderColor = 'hsl(170, 60%, 50%)';

    const baseClasses = "w-72 rounded-lg p-4 shadow-lg transition-all";
    const variantClasses = {
        primary: "bg-[hsl(170,60%,50%)] text-white font-semibold cursor-pointer",
        secondary: "bg-white text-black border-2",
    };

    return (
        <div className="relative animate-in fade-in-50" onClick={onClick}>
            <div
                className={cn(baseClasses, variantClasses[variant], hasCloseButton && "pr-8", className)}
                style={{ borderColor: variant === 'secondary' ? borderColor : 'transparent' }}
            >
                {children}
                {hasCloseButton && (
                    <button 
                        onClick={onClose}
                        className="absolute top-1 right-1 p-1 text-black/50 hover:text-black/80 rounded-full"
                        aria-label="Fechar mensagem"
                    >
                        <X size={16} />
                    </button>
                )}
            </div>
            <div 
                className="absolute top-4 -right-2 w-0 h-0"
                style={{
                    borderTop: '8px solid transparent',
                    borderBottom: '8px solid transparent',
                    borderLeft: `8px solid ${variant === 'secondary' ? borderColor : bubbleColor}`,
                }}
            />
        </div>
    );
};


interface NotificationFABProps {
  hasPendingRequests: boolean;
  hasPendingTasks: boolean;
}

export default function NotificationFAB({ hasPendingRequests, hasPendingTasks }: NotificationFABProps) {
  const { user } = useAuth();
  const { collaborators } = useCollaborators();
  const { messages, markMessageAsRead } = useMessages();
  const { idleMessages } = useIdleFabMessages();
  const { fabMessages, markCampaignAsClicked, interruptCampaign, completeFollowUpPeriod } = useFabMessages();
  const router = useRouter();
  
  const [showNotificationBubble, setShowNotificationBubble] = useState(false);
  const [isIconAnimated, setIsIconAnimated] = useState(false);
  const [showIdleBubble, setShowIdleBubble] = useState(false);
  const [showFollowUpBubble, setShowFollowUpBubble] = useState(false);
  const [currentIdleIndex, setCurrentIdleIndex] = useState(0);

  const currentUser = useMemo(() => {
    if (!user) return null;
    return findCollaboratorByEmail(collaborators, user.email) || null;
  }, [user, collaborators]);

  const activeMessage = useMemo(() => {
    if (!currentUser) return null;
    return fabMessages.find(msg => msg.userId === getCollaboratorUserId(currentUser));
  }, [fabMessages, currentUser]);
  
  // Decide what to display based on priority: CTA > Follow-up > Notification
  const activeCampaign = useMemo(() => {
    if (!activeMessage) return null;
    return activeMessage.pipeline.find(c => c.status === 'active');
  }, [activeMessage]);
  
  const lastCompletedCampaign = useMemo(() => {
    if (!activeMessage) return null;
    return activeMessage.pipeline
      .filter(c => c.status === 'completed' && c.clickedAt)
      .sort((a,b) => parseISO(b.clickedAt!).getTime() - parseISO(a.clickedAt!).getTime())[0] || null;
  }, [activeMessage]);

  const isFollowUpWindowActive = useMemo(() => {
    if (!lastCompletedCampaign?.clickedAt) return false;
    const clickedAtDate = parseISO(lastCompletedCampaign.clickedAt);
    const expirationTime = clickedAtDate.getTime() + 6 * 60 * 60 * 1000;
    return Date.now() < expirationTime;
  }, [lastCompletedCampaign]);

  // CTA Expiration logic
  useEffect(() => {
    if (!currentUser || !activeCampaign?.sentAt) return;
    const sentAtDate = parseISO(activeCampaign.sentAt);
    const expirationTime = sentAtDate.getTime() + 6 * 60 * 60 * 1000;
    
    if (Date.now() > expirationTime) {
      interruptCampaign(getCollaboratorUserId(currentUser) || '');
      return;
    }
    const timeoutId = setTimeout(() => {
      interruptCampaign(getCollaboratorUserId(currentUser) || '');
    }, expirationTime - Date.now());
    return () => clearTimeout(timeoutId);
  }, [activeCampaign, currentUser, interruptCampaign]);

  // Follow-up period expiration logic
  useEffect(() => {
    if (!currentUser || !isFollowUpWindowActive || !lastCompletedCampaign?.clickedAt) return;

    const clickedAtDate = parseISO(lastCompletedCampaign.clickedAt);
    const expirationTime = clickedAtDate.getTime() + 6 * 60 * 60 * 1000;

    const timeoutId = setTimeout(() => {
        completeFollowUpPeriod(getCollaboratorUserId(currentUser) || '');
        setShowFollowUpBubble(false);
    }, expirationTime - Date.now());

    return () => clearTimeout(timeoutId);
  }, [isFollowUpWindowActive, lastCompletedCampaign, currentUser, completeFollowUpPeriod]);
  
  const unreadMessages = useMemo(() => {
    if (!user || !currentUser) return [];
    return messages.filter(msg => {
      const currentUserId = getCollaboratorUserId(currentUser);
      if (!currentUserId || (msg.deletedBy || []).includes(currentUserId)) {
        return false;
      }
      const isRecipient = msg.recipientIds.includes('all') || msg.recipientIds.includes(currentUserId);
      const isUnread = !msg.readBy.includes(currentUserId);
      return isRecipient && isUnread;
    });
  }, [messages, user, currentUser]);
  
  const hasPrimaryAction = !!activeCampaign || hasPendingRequests || hasPendingTasks || unreadMessages.length > 0;
  
  const notificationText = useMemo(() => {
      if (hasPendingTasks) return `Você tem novas tarefas pendentes.\nClique para ver.`;
      if (hasPendingRequests) return `Há solicitações aguardando sua gestão.\nClique para ver.`;
      const count = unreadMessages.length;
      if (count > 0) return `Você tem ${count > 1 ? `${count} novas mensagens` : '1 nova mensagem'}.\nClique para ver.`;
      return null;
  }, [hasPendingTasks, hasPendingRequests, unreadMessages.length]);

  useEffect(() => {
    if (activeCampaign || notificationText) {
      const timer = setTimeout(() => {
        setShowNotificationBubble(true);
        setIsIconAnimated(true);
      }, 2000);
      return () => clearTimeout(timer);
    } else {
      setShowNotificationBubble(false);
      setIsIconAnimated(false);
    }
  }, [activeCampaign, notificationText]);

  const handlePrimaryAction = () => {
    setIsIconAnimated(false);
    setShowNotificationBubble(false);
    setShowIdleBubble(false);
    setShowFollowUpBubble(false);

    if (activeCampaign && currentUser) {
        markCampaignAsClicked(getCollaboratorUserId(currentUser) || '');
        return;
    }

    if (hasPendingTasks) {
        router.push('/me/tasks');
        return;
    }
    if (hasPendingRequests) {
        router.push('/requests');
        return;
    }
    
    if (unreadMessages.length > 0) {
      const messagesCard = document.getElementById('messages-card');
      if (messagesCard) {
        messagesCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (currentUser) {
          unreadMessages.forEach(msg => {
            markMessageAsRead(msg.id, getCollaboratorUserId(currentUser) || '');
          });
        }
      }
    }
  };

  const handleFabClick = () => {
    // If a primary action CTA or notification is showing, the FAB click triggers it.
    if (activeCampaign || notificationText) {
        handlePrimaryAction();
        return;
    }
    
    // If the follow-up window is active, toggle its visibility.
    if (isFollowUpWindowActive) {
        setShowFollowUpBubble(prev => !prev);
        setShowIdleBubble(false);
        return;
    }

    // Otherwise, handle idle messages.
    if (idleMessages.length > 0) {
        setShowIdleBubble(prev => !prev);
        if (!showIdleBubble) { // If we are opening it, cycle the message
            setCurrentIdleIndex(prev => (prev + 1) % idleMessages.length);
        }
        setShowFollowUpBubble(false);
    } else {
        router.push('/chatbot');
    }
  };
  
  const handleFollowUpClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowFollowUpBubble(false);
  };
  
  const handleIdleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowIdleBubble(false);
  };

  return (
    <div className="fixed top-20 right-8 z-50 flex items-start group">
        <div className="absolute right-full mr-4 flex flex-col items-end gap-4">
            {/* CTA Message Bubble */}
            {activeCampaign && showNotificationBubble && (
                <MessageBubble variant="primary" onClick={handlePrimaryAction}>
                    <p className="text-sm">{activeCampaign.ctaMessage}</p>
                </MessageBubble>
            )}

            {/* Follow-up Message Bubble */}
            {isFollowUpWindowActive && showFollowUpBubble && lastCompletedCampaign && (
                <MessageBubble variant="secondary" onClose={handleFollowUpClose} hasCloseButton>
                     <p className="text-sm cursor-default">{lastCompletedCampaign.followUpMessage}</p>
                </MessageBubble>
            )}

            {/* Other Notifications (only shows if no campaign messages) */}
            {!activeCampaign && !isFollowUpWindowActive && showNotificationBubble && notificationText && (
                <MessageBubble onClick={handlePrimaryAction}>
                   <p className="text-sm whitespace-pre-line">{notificationText}</p>
                </MessageBubble>
            )}

            {/* Idle Message Bubble */}
            {showIdleBubble && (
                <MessageBubble 
                    variant="secondary"
                    onClose={handleIdleClose}
                    hasCloseButton
                    onClick={() => setShowIdleBubble(false)}
                >
                   <div className="text-sm dark:prose-invert">
                        <ReactMarkdown 
                            remarkPlugins={[remarkGfm]}
                            components={{ a: ({ ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline" /> }}
                        >
                            {idleMessages[currentIdleIndex]?.text || ''}
                        </ReactMarkdown>
                   </div>
                </MessageBubble>
            )}
        </div>

        <div
            className="relative h-14 w-14 cursor-pointer"
            onClick={handleFabClick}
            aria-label={hasPrimaryAction ? "Ver notificação" : "Abrir assistente"}
        >
            <div
              className={cn(
                "absolute inset-0 bg-background rounded-full border-2 border-[hsl(170,60%,50%)] transition-all duration-200 group-hover:scale-[1.03] group-hover:shadow-xl"
              )}
            ></div>
            <div className="relative z-10 w-full h-full flex items-center justify-center">
                <BobIcon isAnimated={isIconAnimated} />
            </div>
        </div>
    </div>
  );
}
