const isProd = process.env.NODE_ENV === "production";

type LogMeta = Record<string, unknown>;

function sanitize(err: unknown): LogMeta {
  if (err instanceof Error) {
    return {
      message: err.message,
      // Stack traces only in dev — never expose internals to prod logs
      ...(isProd ? {} : { stack: err.stack }),
    };
  }
  return { message: String(err) };
}

export const logger = {
  error(context: string, err: unknown, meta?: LogMeta) {
    // In production: structured JSON without stack traces
    // In dev: full error for debugging
    const entry = {
      level: "error",
      context,
      ts: new Date().toISOString(),
      ...sanitize(err),
      ...(meta ?? {}),
    };
    console.error(JSON.stringify(entry));
  },

  warn(context: string, message: string, meta?: LogMeta) {
    console.warn(JSON.stringify({ level: "warn", context, message, ts: new Date().toISOString(), ...(meta ?? {}) }));
  },
};
