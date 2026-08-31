// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import { limparEvento } from '@/lib/sentryScrub';

Sentry.init({
  dsn: "https://8418847aaa5b98e2627ef8bce0850ea4@o4511486328438784.ingest.us.sentry.io/4511486333091841",

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Enable sending user PII (Personally Identifiable Information)
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: true,

  // Tira credencial do evento ANTES de sair daqui (ver src/lib/sentryScrub.ts).
  // Erro, stack, rota, breadcrumbs e o usuario identificado continuam indo --
  // e isso que faz o alerta servir. O que sai e Authorization e cookie.
  beforeSend: limparEvento,
  beforeSendTransaction: limparEvento,
});
