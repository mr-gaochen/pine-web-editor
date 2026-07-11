# PineTS Web Runner Service

这是一个基于开源项目 [LuxAlgo/PineTS](https://github.com/LuxAlgo/PineTS) 开发的、独立的 Pine Script 策略编译与运行微服务。

本微服务模块采用 **AGPL-3.0** 协议完全开源。

## 架构说明
本项目作为一个“计算沙盒”，通过浏览器 `window.postMessage` 机制接收结构化的 K线数据与 Pine 脚本输入，并在后端调用 PineTS 引擎返回计算日志与交易信号。

## 协议与合规声明
1. 本项目严格遵守 AGPL-3.0 协议，任何对本项目计算服务、前端编辑器的修改与衍生，均须保持开源。
2. 接入本服务的外部商业系统（如第三方用户管理、计费系统等）通过标准的网络接口（Nginx 代理/跨域通信）与本项目实现物理隔离与松耦合，不属于本项目的衍生作品。



# pine-service

独立部署的 PineTS 脚本执行服务，通过 HTTP API 运行 Pine Script 并返回绘图数据，同时支持批量选股。

K 线数据由调用方传入，pine-service 只负责计算。

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `3100` | 监听端口 |
| `HOST` | `0.0.0.0` | 监听地址 |

## 启动

```bash
npm install
```

**开发模式（热重载）**

```bash
npm run dev
```

**生产模式**

```bash
npm run build
npm start
```

**自定义端口**

```bash
PORT=4000 npm run dev
```

默认监听 `0.0.0.0:3100`。

## API

### POST /run

执行 Pine Script，返回绘图数据（单只股票）。

**请求体**

```json
{
  "code": "plot(close, title=\"close\")",
  "period": "day",
  "candles": [
    { "time": "2024-01-02", "open": 10, "high": 11, "low": 9, "close": 10.5, "vol": 1000 }
  ]
}
```

`period` 可选值：`day` / `week` / `month` / `quarter` / `year` / `minute1` / `minute5` / `minute15` / `minute30` / `minute60`

**响应**

```json
[
  {
    "key": "close",
    "color": "#3b82f6",
    "type": "line",
    "data": [
      { "time": "2024-01-02", "value": 10.5 }
    ]
  }
]
```

---

### POST /screen

批量选股：对多只股票运行同一段脚本，并行执行后返回命中结果。K 线数据由调用方提前获取后传入。

**请求体**

```json
{
  "code": "signal = crossover(ta.ema(close,5), ta.ema(close,20))\nplot(signal)",
  "period": "day",
  "stocks": [
    { "ts_code": "000001.SZ", "candles": [...] },
    { "ts_code": "600036.SH", "candles": [...] }
  ]
}
```

**响应**

```json
[
  { "ts_code": "000001.SZ", "matched": true,  "lastValues": { "signal": 1 } },
  { "ts_code": "600036.SH", "matched": false, "lastValues": { "signal": 0 } }
]
```

命中规则：任意 plot 的**最后一根 K 线值非零**即视为命中。单只股票运行出错时 `error` 字段会携带原因，不影响其他股票结果。

---

### GET /health

健康检查，返回 `{ "ok": true }`。
