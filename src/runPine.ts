import type { Kline } from "pinets";
import { PineTS } from "pinets";
import type { CandleData, ScriptPlot, PineAlert } from "./types";

const SCRIPT_COLORS = [
  "#3b82f6", "#ef4444", "#22c55e", "#f59e0b",
  "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16",
];

type KlineEntry = { kline: Kline; chartTime: string | number };

function candlesToKlineEntries(candles: CandleData[], period: string): KlineEntry[] {
  const isIntraday = !["day", "week", "month", "quarter", "year"].includes(period);
  const barDuration = isIntraday
    ? 60_000 * (
        period === "minute1"  ? 1  :
        period === "minute5"  ? 5  :
        period === "minute15" ? 15 :
        period === "minute30" ? 30 : 60
      )
    : 24 * 3600 * 1000 - 1;

  return candles.map((c) => {
    const openTime = typeof c.time === "number"
      ? c.time * 1000
      : new Date(String(c.time)).getTime();
    return {
      chartTime: c.time,
      kline: {
        openTime,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.vol,
        closeTime: openTime + barDuration,
        quoteAssetVolume: c.vol * c.close,
        numberOfTrades: 0,
        takerBuyBaseAssetVolume: 0,
        takerBuyQuoteAssetVolume: 0,
        ignore: 0,
      },
    };
  });
}

export interface RunResult {
  plots: ScriptPlot[];
  alerts: PineAlert[];
}

export async function runPine(
  code: string,
  candles: CandleData[],
  period: string,
): Promise<RunResult> {
  const entries = candlesToKlineEntries(candles, period);
  const pineTS = new PineTS(entries.map((e) => e.kline));
  const result = await pineTS.run(code);
  const overlay: boolean = result.indicator?.overlay ?? true;
  const outputs = result.plots || {};
  const rawAlerts: PineAlert[] = (result.alerts ?? []) as PineAlert[];
  const isInternalKey = (k: string) => /^__.*__$/.test(k);

  const scriptPlots: ScriptPlot[] = [];

  Object.keys(outputs)
    .filter((k) => !isInternalKey(k))
    .forEach((key, idx) => {
      const rawPlot = outputs[key];
      const dataArray: unknown[] = Array.isArray(rawPlot?.data)
        ? rawPlot.data
        : Array.isArray(rawPlot)
        ? rawPlot
        : [];
      const points: Array<{ time: string | number; value: number }> = [];

      for (let i = 0; i < dataArray.length; i++) {
        const item = dataArray[i];
        const raw =
          item != null && typeof item === "object" && "value" in (item as object)
            ? (item as { value: unknown }).value
            : item;
        if (raw == null || !isFinite(Number(raw))) continue;
        const entry = entries[i];
        if (!entry) continue;
        points.push({ time: entry.chartTime, value: Number(raw) });
      }

      const isSignal =
        points.length > 0 && points.every((p) => p.value === 0 || p.value === 1);
      const markerPosition: "aboveBar" | "belowBar" =
        /sell|bear|short|down/i.test(key) ? "aboveBar" : "belowBar";
      const finalPoints = isSignal ? points.filter((p) => p.value !== 0) : points;

      if (finalPoints.length > 0) {
        scriptPlots.push({
          key,
          color: SCRIPT_COLORS[idx % SCRIPT_COLORS.length],
          type: isSignal ? "markers" : "line",
          overlay,
          ...(isSignal ? { markerPosition } : {}),
          data: finalPoints,
        });
      }
    });

  return { plots: scriptPlots, alerts: rawAlerts };
}
