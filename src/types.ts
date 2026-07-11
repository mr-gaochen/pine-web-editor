export interface CandleData {
  time: string | number;
  open: number;
  high: number;
  low: number;
  close: number;
  vol: number;
  pct_chg?: number;
}

export interface ScriptPlot {
  key: string;
  color: string;
  lineWidth?: 1 | 2 | 3 | 4;
  visible?: boolean;
  type?: "line" | "markers";
  markerPosition?: "aboveBar" | "belowBar";
  /** false = 副图（MACD/KDJ 等 overlay=false 的指标）；true 或 undefined = 主图叠加 */
  overlay?: boolean;
  data: Array<{ time: string | number; value: number }>;
}

export interface PineAlert {
  type: "alertcondition" | "alert";
  id: string;
  title?: string;
  message: string;
  bar_index: number;
  time: number;
}

export interface RunRequest {
  code: string;
  candles: CandleData[];
  period: string;
}

export interface ScreenStock {
  ts_code: string;
  candles: CandleData[];
}

export interface ScreenRequest {
  code: string;
  period: string;
  stocks: ScreenStock[];
}

export interface ScreenResult {
  ts_code: string;
  matched: boolean;
  lastValues: Record<string, number | null>;
  /** key = plotshape title, value = "buy" | "sell"，仅包含最后一根K线触发的信号 */
  signals: Record<string, "buy" | "sell">;
  error?: string;
}
