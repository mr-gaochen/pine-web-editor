import path from "node:path";
import Fastify from "fastify";
import cors from "@fastify/cors";
import staticFiles from "@fastify/static";
import { runPine } from "./runPine";
import type { RunRequest, ScreenRequest, ScreenResult } from "./types";

const PORT = Number(process.env.PORT ?? 3100);
const HOST = process.env.HOST ?? "0.0.0.0";

// Comma-separated list of origins allowed to embed this service as an iframe.
// Leave empty to skip origin validation in the iframe (dev-friendly default).
const ALLOWED_ORIGINS: string[] = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean)
  : [];

async function main() {
  const app = Fastify({ logger: true });

  // Allow the main site to call /run and /screen via fetch from the iframe
  await app.register(cors, {
    origin: ALLOWED_ORIGINS.length > 0 ? ALLOWED_ORIGINS : "*",
  });

  // Serve the React build (npm run build:ui → public/)
  await app.register(staticFiles, {
    root: path.join(__dirname, "..", "public"),
    prefix: "/",
  });

  // Serve the React SPA for any non-API route (must be before API routes)
  app.get("/", async (_req, reply) => {
    return reply.sendFile("index.html");
  });

  // Exposes runtime config to the iframe frontend
  app.get("/config", async (_req, reply) => {
    return reply.send({ allowedOrigins: ALLOWED_ORIGINS });
  });

  app.post<{ Body: RunRequest }>("/run", {
    schema: {
      body: {
        type: "object",
        required: ["code", "candles", "period"],
        properties: {
          code:    { type: "string" },
          candles: { type: "array" },
          period:  { type: "string" },
        },
      },
    },
  }, async (request, reply) => {
    const { code, candles, period } = request.body;
    try {
      const { plots, alerts } = await runPine(code, candles, period);
      return reply.send({ plots, alerts });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  app.post<{ Body: ScreenRequest }>("/screen", {
    schema: {
      body: {
        type: "object",
        required: ["code", "period", "stocks"],
        properties: {
          code:   { type: "string" },
          period: { type: "string" },
          stocks: { type: "array" },
        },
      },
    },
  }, async (request, reply) => {
    const { code, period, stocks } = request.body;

    const CONCURRENCY = 20;
    const results: ScreenResult[] = [];
    for (let i = 0; i < stocks.length; i += CONCURRENCY) {
      const chunk = stocks.slice(i, i + CONCURRENCY);
      const chunkResults = await Promise.all(
        chunk.map(async ({ ts_code, candles }): Promise<ScreenResult> => {
          try {
            if (candles.length === 0) {
              return { ts_code, matched: false, lastValues: {}, signals: {} };
            }
            const { plots } = await runPine(code, candles, period);

            const lastCandleTime = String(candles[candles.length - 1].time);
            const lastValues: Record<string, number | null> = {};
            const signals: Record<string, "buy" | "sell"> = {};
            let matched = false;

            for (const plot of plots) {
              if (plot.type !== "markers") {
                lastValues[plot.key] = plot.data.at(-1)?.value ?? null;
                continue;
              }
              const lastPoint = plot.data.at(-1);
              if (!lastPoint) continue;
              if (String(lastPoint.time) === lastCandleTime) {
                matched = true;
                signals[plot.key] = plot.markerPosition === "aboveBar" ? "sell" : "buy";
              }
            }
            return { ts_code, matched, lastValues, signals };
          } catch (err) {
            return {
              ts_code,
              matched: false,
              lastValues: {},
              signals: {},
              error: err instanceof Error ? err.message : String(err),
            };
          }
        })
      );
      results.push(...chunkResults);
    }

    return reply.send(results);
  });

  app.get("/health", async (_req, reply) => {
    return reply.send({ ok: true });
  });

  await app.listen({ port: PORT, host: HOST });
  console.log(`pine-service listening on ${HOST}:${PORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
