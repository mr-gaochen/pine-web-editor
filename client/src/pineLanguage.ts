import type * as Monaco from "monaco-editor";

const PINE_KEYWORDS = [
  "if", "else", "for", "while", "to", "by", "do", "in",
  "var", "varip", "import", "export", "method",
  "true", "false", "na", "not", "and", "or",
  "switch", "type", "enum", "series", "simple", "const", "input",
];

const PINE_BUILTINS = [
  "close", "open", "high", "low", "volume", "hl2", "hlc3", "ohlc4",
  "bar_index", "last_bar_index", "barstate", "ta", "math", "str",
  "array", "matrix", "map", "request", "ticker", "syminfo",
  "strategy", "alert", "plot", "plotshape", "plotchar", "plotarrow",
  "bgcolor", "barcolor", "line", "label", "box", "table",
  "indicator", "library",
];

const PINE_FUNCTIONS = [
  "ta.sma", "ta.ema", "ta.rsi", "ta.macd", "ta.bbands", "ta.atr",
  "ta.stoch", "ta.crossover", "ta.crossunder", "ta.highest", "ta.lowest",
  "math.abs", "math.ceil", "math.floor", "math.round", "math.max", "math.min",
  "math.log", "math.sqrt", "math.pow", "math.sign",
  "str.tostring", "str.tonumber", "str.length", "str.upper", "str.lower",
  "request.security", "array.new_float", "array.push", "array.pop",
  "array.get", "array.set",
];

export function registerPineLanguage(monaco: typeof Monaco): void {
  const id = "pine";
  if (monaco.languages.getLanguages().some((l) => l.id === id)) return;

  monaco.languages.register({ id });
  monaco.languages.setMonarchTokensProvider(id, {
    keywords: PINE_KEYWORDS,
    builtins: PINE_BUILTINS,
    tokenizer: {
      root: [
        [/\/\/.*$/, "comment"],
        [/"([^"\\]|\\.)*"/, "string"],
        [/'([^'\\]|\\.)*'/, "string"],
        [/\b\d+(\.\d+)?\b/, "number"],
        [/\b(ta|math|str|array|matrix|map|request|ticker|syminfo|strategy)\.[a-zA-Z_]\w*/, "keyword.function"],
        [new RegExp(`\\b(${PINE_KEYWORDS.join("|")})\\b`), "keyword"],
        [new RegExp(`\\b(${PINE_BUILTINS.join("|")})\\b`), "variable.predefined"],
        [/[a-zA-Z_]\w*/, "identifier"],
        [/[=><!+\-*/&|^~%]+/, "operator"],
      ],
    },
  });

  monaco.languages.setLanguageConfiguration(id, {
    comments: { lineComment: "//" },
    brackets: [["(", ")"], ["[", "]"]],
    autoClosingPairs: [
      { open: "(", close: ")" },
      { open: "[", close: "]" },
      { open: '"', close: '"' },
    ],
  });

  monaco.editor.defineTheme("pine-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "keyword",             foreground: "ffffff", fontStyle: "bold" },
      { token: "keyword.function",    foreground: "a8a8a8" },
      { token: "variable.predefined", foreground: "787878" },
      { token: "number",              foreground: "d0d0d0" },
      { token: "string",              foreground: "686868" },
      { token: "comment",             foreground: "3c3c3c", fontStyle: "italic" },
      { token: "operator",            foreground: "909090" },
    ],
    colors: {
      "editor.background":              "#0d0d0d",
      "editor.foreground":              "#d4d4d4",
      "editorLineNumber.foreground":    "#2c2c2c",
      "editor.selectionBackground":     "#1e1e1e",
      "editor.lineHighlightBackground": "#131313",
    },
  });

  monaco.editor.defineTheme("pine-light", {
    base: "vs",
    inherit: true,
    rules: [
      { token: "keyword",             foreground: "000000", fontStyle: "bold" },
      { token: "keyword.function",    foreground: "333333" },
      { token: "variable.predefined", foreground: "555555" },
      { token: "number",              foreground: "1a1a1a" },
      { token: "string",              foreground: "666666" },
      { token: "comment",             foreground: "aaaaaa", fontStyle: "italic" },
      { token: "operator",            foreground: "444444" },
    ],
    colors: {
      "editor.background":              "#ffffff",
      "editor.foreground":              "#1a1a1a",
      "editorLineNumber.foreground":    "#d0d0d0",
      "editor.selectionBackground":     "#eeeeee",
      "editor.lineHighlightBackground": "#f8f8f8",
    },
  });

  monaco.languages.registerCompletionItemProvider(id, {
    provideCompletionItems(model, position) {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber:   position.lineNumber,
        startColumn:     word.startColumn,
        endColumn:       word.endColumn,
      };
      return {
        suggestions: [
          ...PINE_KEYWORDS.map((kw) => ({
            label: kw, kind: monaco.languages.CompletionItemKind.Keyword, insertText: kw, range,
          })),
          ...PINE_BUILTINS.map((b) => ({
            label: b, kind: monaco.languages.CompletionItemKind.Variable, insertText: b, range,
          })),
          ...PINE_FUNCTIONS.map((fn) => ({
            label: fn,
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: fn + "(${1})",
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
          })),
        ],
      };
    },
  });
}
