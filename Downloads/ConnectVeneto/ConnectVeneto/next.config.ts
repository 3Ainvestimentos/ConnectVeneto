
import type {NextConfig} from 'next';
import path from 'path';

const TRACKFLOW_URL      = process.env.NEXT_PUBLIC_TRACKFLOW_URL      ?? 'http://localhost:3001';
const PORTAL_REPASSE_URL = process.env.NEXT_PUBLIC_PORTAL_REPASSE_URL ?? 'http://localhost:3000';

const nextConfig: NextConfig = {
  /* config options here */
  // Source maps desabilitados em produção — nunca expor código-fonte TypeScript ao navegador.
  // Para depurar erros de produção, use ferramentas de logging/tracing server-side (ex.: Sentry).
  productionBrowserSourceMaps: false,
  // Build local permanece tolerante até zerar dívida histórica de tipagem/lint.
  // O bloqueio obrigatório está no pipeline (.github/workflows/quality-gates.yml).
  typescript: {
    // TODO: mudar para false quando typecheck estiver sem baseline.
    ignoreBuildErrors: false,
  },
  eslint: {
    // TODO: mudar para false quando quisermos falhar o next build também localmente.
    ignoreDuringBuilds: false,
  },
  // Fixar raiz de tracing/monorepo para evitar seleção incorreta de workspace fora do projeto
  outputFileTracingRoot: path.join(__dirname),
  
  async redirects() {
    return [
      {
        source: "/labs",
        destination: "/regras-comerciais",
        permanent: true,
      },
      {
        source: "/rankings",
        destination: "/area-logada",
        permanent: true,
      },
    ];
  },

  // Muitos navegadores pedem /favicon.ico antes de aplicar <link rel="icon">;
  // sem arquivo .ico, acabam usando cache ou ícone genérico.
  async rewrites() {
    return [{ source: "/favicon.ico", destination: "/icon.png" }];
  },

  // Headers de segurança
  async headers() {
    const isProd = process.env.NODE_ENV === 'production';
    return [
      {
        // Aplicar headers de segurança em todas as rotas
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: (() => {
              const directives = [
                "default-src 'self'",
                // 'unsafe-eval' apenas em dev (para HMR do Next.js) — NUNCA em produção.
                // Em produção, 'unsafe-eval' é removido pois é vetor de XSS avançado.
                isProd
                  ? "script-src 'self' 'unsafe-inline' https://apis.google.com https://www.gstatic.com https://www.google.com https://www.recaptcha.net https://cdn.jsdelivr.net https://s.tradingview.com https://s3.tradingview.com"
                  : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://www.gstatic.com https://www.google.com https://www.recaptcha.net https://cdn.jsdelivr.net https://s.tradingview.com https://s3.tradingview.com http://localhost:3000 http://127.0.0.1:3000",
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://s.tradingview.com",
                "img-src 'self' data: https: blob:",
                "font-src 'self' data: https://fonts.gstatic.com",
                "media-src 'self' https://firebasestorage.googleapis.com blob:",
                // Permissivo em dev para evitar timeouts/HMR; mais restrito em prod
                isProd
                  ? "connect-src 'self' https://www.3arivaconnect.com.br https://3arivaconnect.com.br https://www.google.com https://apis.google.com https://accounts.google.com https://*.googleapis.com https://content-firebaseappcheck.googleapis.com https://*.firebaseio.com https://*.cloudfunctions.net https://firebasestorage.googleapis.com wss://*.firebaseio.com https://connect-backup-five.vercel.app https://connect-backup-git-master-henriques-projects-7f498294.vercel.app https://connect-backup-65lxk0nm1-henriques-projects-7f498294.vercel.app"
                  : "connect-src 'self' http://localhost:3000 ws://localhost:3000 http://127.0.0.1:3000 ws://127.0.0.1:3000 https://www.google.com https://apis.google.com https://accounts.google.com https://*.googleapis.com https://content-firebaseappcheck.googleapis.com https://*.firebaseio.com https://*.cloudfunctions.net https://firebasestorage.googleapis.com wss://*.firebaseio.com https://connect-backup-five.vercel.app https://connect-backup-git-master-henriques-projects-7f498294.vercel.app https://connect-backup-65lxk0nm1-henriques-projects-7f498294.vercel.app",
                `frame-src 'self' ${TRACKFLOW_URL} ${PORTAL_REPASSE_URL} https://www.youtube.com https://s.tradingview.com https://tradingview-widget.com https://*.tradingview-widget.com https://www.google.com https://*.google.com https://*.googleapis.com https://*.firebaseapp.com https://*.web.app https://www.recaptcha.net https://firebasestorage.googleapis.com https://calendar.google.com https://drive.google.com https://docs.google.com https://content.googleapis.com https://studio--datavisor-44i5m.us-central1.hosted.app https://studio--studio-9152494730-25d31.us-central1.hosted.app https://studio--studio-1518788599-dba08.us-central1.hosted.app https://bob-1-0-backup.vercel.app https://bob-1-0-vercel.vercel.app/ https://connect-backup-five.vercel.app https://connect-backup-git-master-henriques-projects-7f498294.vercel.app https://connect-backup-65lxk0nm1-henriques-projects-7f498294.vercel.app https://nina-prod-backup.vercel.app/ https://*.powerbi.com https://app.powerbi.com https://*.pbidedicated.windows.net https://*.analysis.windows.net https://studio--ted-10.us-central1.hosted.app/  https://ted-plan.vercel.app/ https://ted-cyan.vercel.app https://radarfin.com.br/latest https://radarfin.com.br/ https://www.radarfin.com.br https://*.radarfin.com.br https://forms.office.com https://*.forms.office.com https://dashboard.3arivaconnect.com.br https://www.venetostore.com.br https://venetostore.com.br`,
                "worker-src 'self' blob:",
                "object-src 'none'",
                "base-uri 'self'",
                "form-action 'self'",
                "frame-ancestors 'none'",
              ];
              if (isProd) directives.push('upgrade-insecure-requests');
              return directives.join('; ');
            })(),
          },
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(self "https://studio--studio-9152494730-25d31.us-central1.hosted.app"), geolocation=(), interest-cohort=()',
          },
        ],
      },
    ];
  },
  
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'i.ibb.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      }
    ],
  },
};
export default nextConfig;

  
