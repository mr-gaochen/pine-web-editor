import { useCallback, useEffect, useRef, useState } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import { Play, Sun, Moon, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import type { CandleData, InboundMessage, PineAlert, ScriptPlot } from "./types";
import { registerPineLanguage } from "./pineLanguage";

// ── Types ─────────────────────────────────────────────────────────────────────

type LogLevel = "info" | "success" | "error" | "warn";
interface LogEntry { id: number; msg: string; level: LogLevel }
type Status = "ready" | "running" | "success" | "error";

// ── Theme tokens (mirrors pineTypes.getTheme) ─────────────────────────────────

interface ThemeTokens {
  bg: string; consoleBg: string; border: string;
  headerText: string; subText: string;
  btnHover: string; btnIcon: string;
  badge: string; emptyLog: string;
  logError: string; logSuccess: string; logWarn: string; logInfo: string;
  runBtn: string; runBtnDis: string; runSpinner: string;
  resizeBar: string;
}

function getTheme(isDark: boolean): ThemeTokens {
  if (isDark) return {
    bg:         "bg-[#0d0d0d] text-[#e8e8e8]",
    consoleBg:  "bg-[#080808]",
    border:     "border-[#1e1e1e]",
    headerText: "text-[#e8e8e8]",
    subText:    "text-[#444]",
    btnHover:   "hover:bg-[#1a1a1a] hover:text-[#e0e0e0]",
    btnIcon:    "text-[#555]",
    badge:      "bg-[#1a1a1a] text-[#555]",
    emptyLog:   "text-[#333]",
    logError:   "text-[#e05252]",
    logSuccess: "text-[#6a9955]",
    logWarn:    "text-[#ce9178]",
    logInfo:    "text-[#555]",
    resizeBar:  "bg-[#1a1a1a] hover:bg-[#2a2a2a]",
    runBtn:     "bg-white hover:bg-[#e8e8e8] text-black",
    runBtnDis:  "bg-[#1c1c1c] text-[#404040] cursor-not-allowed",
    runSpinner: "border-[#2a2a2a] border-t-[#555]",
  };
  return {
    bg:         "bg-white text-[#111]",
    consoleBg:  "bg-[#fafafa]",
    border:     "border-[#ebebeb]",
    headerText: "text-[#111]",
    subText:    "text-[#aaa]",
    btnHover:   "hover:bg-[#f5f5f5] hover:text-[#111]",
    btnIcon:    "text-[#aaa]",
    badge:      "bg-[#f0f0f0] text-[#999]",
    emptyLog:   "text-[#ccc]",
    logError:   "text-[#c0392b]",
    logSuccess: "text-[#27ae60]",
    logWarn:    "text-[#e67e22]",
    logInfo:    "text-[#888]",
    resizeBar:  "bg-[#ebebeb] hover:bg-[#d8d8d8]",
    runBtn:     "bg-[#111] hover:bg-black text-white",
    runBtnDis:  "bg-[#f0f0f0] text-[#c8c8c8] cursor-not-allowed",
    runSpinner: "border-[#ddd] border-t-[#aaa]",
  };
}

const STATUS_LABEL: Record<Status, string> = {
  ready: "就绪", running: "运行中...", success: "运行成功", error: "运行出错",
};
const STATUS_COLOR: Record<Status, string> = {
  ready: "text-[#888]", running: "text-yellow-500", success: "text-emerald-500", error: "text-red-500",
};

function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

let logSeq = 0;

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const editorRef         = useRef<Parameters<OnMount>[0] | null>(null);
  const monacoRef         = useRef<Parameters<OnMount>[1] | null>(null);
  const candlesRef        = useRef<CandleData[]>([]);
  const periodRef         = useRef<string>("day");
  const allowedOriginsRef = useRef<string[]>([]);
  const logEndRef         = useRef<HTMLDivElement>(null);

  const [isDark, setIsDark]                 = useState(false);
  const [status, setStatus]                 = useState<Status>("ready");
  const [logs, setLogs]                     = useState<LogEntry[]>([]);
  const [consoleCollapsed, setConsoleCollapsed] = useState(false);

  const t = getTheme(isDark);

  const addLog = useCallback((msg: string, level: LogLevel = "info") => {
    setLogs(prev => [...prev, { id: logSeq++, msg, level }]);
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Fetch allowed origins
  useEffect(() => {
    fetch("/config")
      .then(r => r.json())
      .then((cfg: { allowedOrigins?: string[] }) => {
        allowedOriginsRef.current = cfg.allowedOrigins ?? [];
      })
      .catch(() => {});
  }, []);

  // postMessage listener
  useEffect(() => {
    function handler(event: MessageEvent) {
      const origins = allowedOriginsRef.current;
      if (origins.length > 0 && !origins.includes(event.origin)) return;
      const msg = event.data as InboundMessage;
      if (!msg || typeof msg.type !== "string") return;

      switch (msg.type) {
        case "PINE_INIT":
          if (editorRef.current && typeof msg.code === "string") {
            editorRef.current.setValue(msg.code);
          }
          candlesRef.current = msg.candles ?? [];
          periodRef.current  = msg.period ?? "day";
          addLog(`已加载策略代码（${candlesRef.current.length} 根K线，周期: ${periodRef.current}）`, "success");
          setStatus("ready");
          break;

        case "PINE_UPDATE_CANDLES":
          candlesRef.current = msg.candles ?? [];
          periodRef.current  = msg.period ?? periodRef.current;
          addLog(`K线数据已更新（${candlesRef.current.length} 根，周期: ${periodRef.current}）`, "info");
          break;

        case "PINE_REQUEST_CODE":
          if (editorRef.current) {
            window.parent.postMessage(
              { type: "PINE_CODE_SNAPSHOT", code: editorRef.current.getValue() },
              event.origin || "*"
            );
          }
          break;

        case "PINE_RUN":
          handleRun();
          break;

        // AI 服务处理完毕，将新代码写回编辑器
        case "PINE_AI_SUGGEST":
          if (editorRef.current && msg.code) {
            editorRef.current.setValue(msg.code);
            addLog("✦ AI 已更新代码", "success");
          }
          break;
      }
    }
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [addLog]);

  // Monaco mount
  const handleEditorMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current  = editor;
    monacoRef.current  = monaco;
    registerPineLanguage(monaco);
    monaco.editor.setTheme(isDark ? "pine-dark" : "pine-light");
    const model = editor.getModel();
    if (model) monaco.editor.setModelLanguage(model, "pine");
    window.parent.postMessage({ type: "PINE_READY" }, "*");
    addLog("编辑器就绪", "info");

    editor.onDidChangeModelContent(() => {
      window.parent.postMessage({ type: "PINE_CODE_CHANGED" }, "*");
    });
  }, [addLog]);

  // Theme toggle
  const toggleTheme = useCallback(() => {
    setIsDark(prev => {
      const next = !prev;
      monacoRef.current?.editor.setTheme(next ? "pine-dark" : "pine-light");
      return next;
    });
  }, []);

  // Run
  const handleRun = useCallback(async () => {
    if (!editorRef.current) return;
    const code = editorRef.current.getValue().trim();
    if (!code) return;

    if (candlesRef.current.length === 0) {
      addLog("尚未接收到K线数据，请先打开图表", "error");
      setConsoleCollapsed(false);
      return;
    }

    setStatus("running");
    setConsoleCollapsed(false);
    addLog("─── 开始运行 ───", "info");

    try {
      const res = await fetch("/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, candles: candlesRef.current, period: periodRef.current }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
        throw new Error(errData.error ?? res.statusText);
      }

      const { plots, alerts } = await res.json() as { plots: ScriptPlot[]; alerts: PineAlert[] };

      addLog(`✓ 执行完成，${plots.length} 条线已绘制到图表`, "success");
      alerts.forEach(a => addLog(`[Alert] ${a.title ?? a.id}: ${a.message}`, "warn"));

      setStatus("success");
      window.parent.postMessage({ type: "PINE_RUN_RESULT", plots, alerts }, "*");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      addLog(`✗ 运行异常: ${message}`, "error");
      setStatus("error");
      window.parent.postMessage({ type: "PINE_ERROR", message }, "*");
    }
  }, [addLog]);

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className={cn("flex flex-col h-screen overflow-hidden", t.bg)}>

      {/* ── Toolbar ── */}
      <div className={cn("flex items-center gap-2 px-4 py-2.5 border-b shrink-0", t.border)}>
        <span className={cn("text-sm font-semibold", t.headerText)}>Pine Script</span>
        <div className="flex-1" />

        <span className={cn("text-xs", STATUS_COLOR[status])}>
          {STATUS_LABEL[status]}
        </span>

        <button
          onClick={toggleTheme}
          title={isDark ? "切换浅色主题" : "切换深色主题"}
          className={cn("p-1.5 rounded-md transition-colors", t.btnIcon, t.btnHover)}
        >
          {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
        </button>

        <button
          onClick={handleRun}
          disabled={status === "running"}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
            status === "running" ? t.runBtnDis : t.runBtn,
          )}
        >
          {status === "running"
            ? <span className={cn("h-3.5 w-3.5 rounded-full border-2 animate-spin inline-block", t.runSpinner)} />
            : <Play className="h-3.5 w-3.5" />}
          运行
        </button>
      </div>

      {/* ── Monaco Editor ── */}
      <div className="flex-1 min-h-0">
        <Editor
          defaultLanguage="pine"
          defaultValue={`//@version=5\nindicator("My Script", overlay=true)\n`}
          theme="pine-dark"
          onMount={handleEditorMount}
          options={{
            fontSize: 13,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
            fontLigatures: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            lineNumbers: "on",
            wordWrap: "on",
            tabSize: 4,
            automaticLayout: true,
            padding: { top: 12, bottom: 12 },
            smoothScrolling: true,
          }}
        />
      </div>

      {/* ── Console ── */}
      <div className={cn("shrink-0 flex flex-col border-t", t.consoleBg, t.border)}>
        {/* Console header */}
        <div className={cn("flex items-center gap-2 px-3 py-1.5 border-b shrink-0", t.border)}>
          <button
            onClick={() => setConsoleCollapsed(v => !v)}
            className={cn("flex items-center gap-1.5 text-xs font-medium transition-colors", t.btnIcon, t.btnHover)}
          >
            {consoleCollapsed
              ? <ChevronUp className="h-3.5 w-3.5" />
              : <ChevronDown className="h-3.5 w-3.5" />}
            控制台
            {logs.length > 0 && (
              <span className={cn("text-[10px] rounded px-1", t.badge)}>{logs.length}</span>
            )}
          </button>
          <div className="flex-1" />
          {logs.length > 0 && (
            <button
              onClick={() => setLogs([])}
              title="清空"
              className={cn("p-1 rounded transition-colors", t.btnIcon, t.btnHover)}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Log entries */}
        {!consoleCollapsed && (
          <div className="h-36 overflow-y-auto px-3 py-2 font-mono text-[11px] space-y-0.5">
            {logs.length === 0 ? (
              <span className={t.emptyLog}>点击"运行"执行脚本…</span>
            ) : (
              logs.map(entry => (
                <div
                  key={entry.id}
                  className={cn(
                    "leading-relaxed whitespace-pre-wrap break-all",
                    entry.level === "error"   && t.logError,
                    entry.level === "success" && t.logSuccess,
                    entry.level === "warn"    && t.logWarn,
                    entry.level === "info"    && t.logInfo,
                  )}
                >
                  {entry.msg}
                </div>
              ))
            )}
            <div ref={logEndRef} />
          </div>
        )}
      </div>
    </div>
  );
}
