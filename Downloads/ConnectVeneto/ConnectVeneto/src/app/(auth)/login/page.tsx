
"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Loader2, Construction, Maximize2, PanelLeft } from "lucide-react";
import Image from "next/image";
import { useSystemSettings } from "@/contexts/SystemSettingsContext";
import { useTheme } from "@/contexts/ThemeContext";
import logoVenetoDark from "../../../../docs/PNG/logotipo_vênetoPrancheta 1.png";
import logoVenetoLight from "../../../../docs/PNG/logotipo_vênetoPrancheta_3_upscaled.png";

const LOGIN_LAYOUT_KEY = "veneto-login-layout";

type LoginLayout = "immersive" | "split";

const GoogleIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="20px" height="20px" {...props}>
    <path
      fill="#FFC107"
      d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"
    />
    <path
      fill="#FF3D00"
      d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"
    />
    <path
      fill="#4CAF50"
      d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.222,0-9.651-3.356-11.303-8H6.306C9.656,39.663,16.318,44,24,44z"
    />
    <path
      fill="#1976D2"
      d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571l6.19,5.238C42.022,35.14,44,30.026,44,24C44,22.659,43.862,21.35,43.611,20.083z"
    />
  </svg>
);

function LoginVideo({
  src,
  className,
  prefersReducedMotion,
}: {
  src: string;
  className: string;
  prefersReducedMotion: boolean;
}) {
  if (prefersReducedMotion) return null;
  return (
    <video
      className={className}
      autoPlay
      loop
      muted
      playsInline
      preload="auto"
      aria-hidden
    >
      <source src={src} type="video/mp4" />
    </video>
  );
}

export default function LoginPage() {
  const { signInWithGoogle, loading: authLoading } = useAuth();
  const { settings, loading: settingsLoading } = useSystemSettings();
  const { theme } = useTheme();

  const loading = authLoading || settingsLoading;
  const maintenanceMode = settings.maintenanceMode;

  const logoImmersive = theme === "dark" ? logoVenetoLight : logoVenetoDark;

  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [loginLayout, setLoginLayout] = useState<LoginLayout>("immersive");

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefersReducedMotion(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(LOGIN_LAYOUT_KEY);
      if (stored === "split" || stored === "immersive") {
        setLoginLayout(stored);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const toggleLayout = () => {
    setLoginLayout((prev) => {
      const next: LoginLayout = prev === "immersive" ? "split" : "immersive";
      try {
        sessionStorage.setItem(LOGIN_LAYOUT_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const googleButton = (
    <Button
      onClick={signInWithGoogle}
      disabled={loading || maintenanceMode}
      size="lg"
      variant="outline"
      className={
        loginLayout === "split"
          ? "w-full max-w-xs rounded-full border-[#0d1d2c]/25 bg-white font-body font-semibold text-[#0d1d2c] hover:bg-[#0d1d2c]/5 hover:text-[#0d1d2c]"
          : "w-full max-w-xs rounded-full font-body font-semibold text-foreground/80 hover:bg-card hover:text-foreground/80"
      }
    >
      {loading ? (
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
      ) : (
        <GoogleIcon className="mr-2 h-5 w-5" />
      )}
      Entrar com Google
    </Button>
  );

  const maintenanceBlock =
    maintenanceMode ? (
      <div
        className={
          loginLayout === "split"
            ? "mb-4 w-full rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-center text-amber-900"
            : "mb-4 w-full rounded-md border border-amber-500/50 bg-amber-500/10 p-4 text-center text-amber-700"
        }
      >
        <Construction className="mx-auto mb-2 h-6 w-6 text-amber-600" />
        <p className="text-sm font-semibold">Plataforma em Manutenção</p>
        <p className="text-xs">{settings.maintenanceMessage}</p>
      </div>
    ) : null;

  const layoutToggle = (
    <button
      type="button"
      onClick={toggleLayout}
      className="fixed bottom-6 right-24 z-[60] flex h-11 w-11 items-center justify-center rounded-full border border-white/35 bg-black/45 text-white shadow-lg backdrop-blur-sm transition-colors hover:bg-black/55 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e1ca5f]"
      aria-label={
        loginLayout === "immersive"
          ? "Alternar para layout com painel à esquerda"
          : "Alternar para layout em tela cheia"
      }
      title={
        loginLayout === "immersive"
          ? "Layout em painéis (1/3 + vídeo)"
          : "Layout em tela cheia"
      }
    >
      {loginLayout === "immersive" ? (
        <PanelLeft className="h-5 w-5" strokeWidth={2} />
      ) : (
        <Maximize2 className="h-5 w-5" strokeWidth={2} />
      )}
    </button>
  );

  if (loginLayout === "split") {
    return (
      <main className="relative flex min-h-screen w-screen flex-col overflow-hidden bg-white lg:min-h-0 lg:h-screen lg:flex-row">
        {layoutToggle}

        <section className="flex min-h-[50vh] w-full flex-col bg-white lg:h-screen lg:w-1/3">
          <div className="flex flex-1 flex-col items-center justify-center px-8 py-12 lg:py-8">
            <div className="flex w-full max-w-sm flex-col items-center">
              <Image
                src={logoVenetoDark}
                alt="Logo Veneto Family Office"
                width={220}
                height={52}
                priority
                className="mb-10"
              />
              {maintenanceBlock}
              {googleButton}
            </div>
          </div>
          <footer className="mt-auto px-6 pb-8 pt-4 text-center text-[10px] leading-snug text-[#0d1d2c]/50 sm:px-8 sm:text-[11px]">
            <p className="text-pretty">
              Sujeito aos Termos de Uso e à Política de Privacidade da Vêneto Family
              {"\u00A0"}
              Office.
            </p>
            <p className="mt-1.5">Todos os direitos reservados.</p>
          </footer>
        </section>

        <section className="relative min-h-[42vh] flex-1 bg-[#0d1d2c] lg:min-h-0 lg:w-2/3">
          <LoginVideo
            src="/videos/connect-veneto-v1.mp4"
            prefersReducedMotion={prefersReducedMotion}
            className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 z-10 bg-gradient-to-l from-black/20 via-transparent to-black/15" />
        </section>
      </main>
    );
  }

  return (
    <main className="relative flex h-screen w-screen items-center justify-center overflow-hidden bg-[#0d1d2c]">
      {layoutToggle}

      <LoginVideo
        src="/videos/connect-veneto-v2.mp4"
        prefersReducedMotion={prefersReducedMotion}
        className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 z-10 bg-gradient-to-b from-black/25 via-black/35 to-black/55" />

      <div className="relative z-20 flex w-full max-w-md flex-col items-center justify-center rounded-xl bg-card px-12 py-8 shadow-2xl">
        <Image
          src={logoImmersive}
          alt="Logo Veneto Family Office"
          width={200}
          height={48}
          priority
          className="mb-6"
        />
        {maintenanceBlock}
        {googleButton}
      </div>

      <footer className="absolute bottom-4 left-0 right-0 z-20 p-4 text-center text-xs text-white/60">
        <p>Sujeito aos Termos de Uso e à Política de Privacidade da Vêneto Family Office.</p>
        <p>Todos os direitos reservados.</p>
      </footer>
    </main>
  );
}
