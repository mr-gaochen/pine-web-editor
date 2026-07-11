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

// ─── postMessage: main site → iframe ──────────────────────────────────────────
export type InboundMessage =
  // 初始化：传入策略代码 + K线数据
  | { type: "PINE_INIT"; code: string; candles: CandleData[]; period: string }
  // 更新K线（切换标的/周期时）
  | { type: "PINE_UPDATE_CANDLES"; candles: CandleData[]; period: string }
  // 索取当前编辑器代码（主站"保存"按钮触发）
  | { type: "PINE_REQUEST_CODE" }
  // 主站触发运行（可选，用户也可在 iframe 内点按钮）
  | { type: "PINE_RUN" }
  // AI 建议：用新代码替换编辑器内容（主站 AI 服务处理后回传）
  | { type: "PINE_AI_SUGGEST"; code: string };

// ─── postMessage: iframe → main site ──────────────────────────────────────────
export type OutboundMessage =
  // 编辑器挂载完毕，主站可以开始发送 PINE_INIT
  | { type: "PINE_READY" }
  // 当前代码快照（响应 PINE_REQUEST_CODE）
  | { type: "PINE_CODE_SNAPSHOT"; code: string }
  // 运行结果
  | { type: "PINE_RUN_RESULT"; plots: ScriptPlot[]; alerts: PineAlert[] }
  // 运行错误
  | { type: "PINE_ERROR"; message: string }
  // 编辑器内容变化（代码被修改，需重新运行才能保存）
  | { type: "PINE_CODE_CHANGED" };
