// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://8418847aaa5b98e2627ef8bce0850ea4@o4511486328438784.ingest.us.sentry.io/4511486333091841",

  // Session Replay com mascaramento EXPLICITO.
  //
  // Sao os defaults do SDK, mas escritos aqui de proposito: o cadastro da Bynx
  // coleta CPF, e replay sem mascara gravaria o campo sendo digitado. Deixar
  // implicito significa que uma atualizacao de default vira vazamento de dado
  // pessoal sem ninguem perceber.
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      maskAllInputs: true,
      blockAllMedia: true,
    }),
  ],

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,
  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Define how likely Replay events are sampled.
  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  replaysSessionSampleRate: 0.1,

  // Define how likely Replay events are sampled when an error occurs.
  replaysOnErrorSampleRate: 1.0,

  // Enable sending user PII (Personally Identifiable Information)
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: true,

  // Filtra ruido nao acionavel (ambiente do usuario, nao bug do app)
  ignoreErrors: [
    // Recursos/imagens que falham no browser do usuario (adblock, rede, offline)
    "Load failed",
    "Failed to fetch",
    "NetworkError when attempting to fetch resource",
    "The network connection was lost",
    "The request timed out",
    "cancelled",
    // Lock benigno do supabase-js (auth-token roubado por outra aba/requisicao)
    "was released because another request stole it",
    // Storage indisponivel em alguns WebViews (ja tratado com try/catch no codigo)
    "Cannot read properties of null (reading 'getItem')",
    "The operation is insecure",
    // Ruidos comuns de extensoes/navegador
    "ResizeObserver loop",
    "Non-Error promise rejection captured",

    // ── Navegador embutido de Instagram/Facebook/TikTok ──────────────────
    // Esses apps injetam scripts proprios na WebView. Quando a pagina navega,
    // a ponte nativa some e o script deles estoura. Nao e codigo da Bynx e
    // nao ha o que consertar — mas em 26/07/2026 estes tres eram as issues
    // de MAIOR volume do projeto (96 usuarios somados), enterrando erro real.
    "window.webkit.messageHandlers",
    "Java object is gone",
    "Error invoking postMessage",
    "enableDidUserTypeOnKeyboardLogging",

    // ── Lock do supabase-js ──────────────────────────────────────────────
    // A entrada antiga so pegava uma das tres redacoes que o SDK emite.
    "Lock broken by another request",
    "Lock was stolen by another request",

    // ── Extensoes de cripto injetando provider ───────────────────────────
    "Failed to connect to MetaMask",
    "ethereum",

    // React x extensao que mexe no DOM por fora (tradutor, leitor).
    "Failed to execute 'removeChild' on 'Node'",
  ],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
