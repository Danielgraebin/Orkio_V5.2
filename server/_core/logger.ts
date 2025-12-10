/**
 * Structured logger for observability
 * Outputs JSON logs to stdout for easy integration with log aggregators
 */

export const logger = {
  info: (msg: string, meta: Record<string, any> = {}) =>
    console.log(JSON.stringify({ level: "info", msg, ts: Date.now(), ...meta })),
  
  error: (msg: string, meta: Record<string, any> = {}) =>
    console.error(JSON.stringify({ level: "error", msg, ts: Date.now(), ...meta })),
  
  warn: (msg: string, meta: Record<string, any> = {}) =>
    console.warn(JSON.stringify({ level: "warn", msg, ts: Date.now(), ...meta })),
  
  debug: (msg: string, meta: Record<string, any> = {}) =>
    console.debug(JSON.stringify({ level: "debug", msg, ts: Date.now(), ...meta })),
};
