# PineTS Web Runner Service

这是一个基于开源项目 [LuxAlgo/PineTS](https://github.com/LuxAlgo/PineTS) 开发的、独立的 Pine Script 策略编译与运行微服务。

本微服务模块采用 **AGPL-3.0** 协议完全开源。

## 架构说明
本项目作为一个“计算沙盒”，通过浏览器 `window.postMessage` 机制接收结构化的 K线数据与 Pine 脚本输入，并在后端调用 PineTS 引擎返回计算日志与交易信号。

## 协议与合规声明
1. 本项目严格遵守 AGPL-3.0 协议，任何对本项目计算服务、前端编辑器的修改与衍生，均须保持开源。
2. 接入本服务的外部商业系统（如第三方用户管理、计费系统等）通过标准的网络接口（Nginx 代理/跨域通信）与本项目实现物理隔离与松耦合，不属于本项目的衍生作品。
