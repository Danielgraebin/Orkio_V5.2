// client/src/_core/env.ts
// Reexporta o carregador de variáveis em runtime (window._ENV ou defaults)
import { loadENV } from "./_essencial/runtimeEnv";

export const ENV = loadENV();
