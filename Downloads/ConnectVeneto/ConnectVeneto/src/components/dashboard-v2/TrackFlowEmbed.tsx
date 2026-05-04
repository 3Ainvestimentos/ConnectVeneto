'use client';

import { useEffect, useRef, useCallback } from 'react';
import { getAuth } from 'firebase/auth';
import { getFirebaseApp } from '@/lib/firebase';

const TRACKFLOW_URL = (process.env.NEXT_PUBLIC_TRACKFLOW_URL ?? 'https://vnt-trackflow.azurewebsites.net').replace(/\/$/, '');
const MODULE_ID = 'trackflow';

export default function TrackFlowEmbed({ fullHeight }: { fullHeight?: boolean }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const issueToken = useCallback(async (): Promise<string | null> => {
    const auth = getAuth(getFirebaseApp());
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) return null;

    const res = await fetch(`/api/modules/${MODULE_ID}/token`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!res.ok) return null;
    const { token } = await res.json();
    return token as string;
  }, []);

  const sendToken = useCallback(async () => {
    const token = await issueToken();
    if (!token || !iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage(
      { type: 'CV_AUTH_TOKEN', token },
      TRACKFLOW_URL
    );
  }, [issueToken]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== TRACKFLOW_URL) return;
      const type = event.data?.type;
      if (type === 'CV_REQUEST_AUTH' || type === 'CV_TOKEN_EXPIRED') {
        sendToken();
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [sendToken]);

  return (
    <iframe
      ref={iframeRef}
      src={`${TRACKFLOW_URL}/embed`}
      className={`w-full border-0 rounded-lg ${fullHeight ? 'h-full min-h-[calc(100vh-12rem)]' : 'h-full min-h-[680px]'}`}
      title="TrackFlow — Solicitações"
    />
  );
}
