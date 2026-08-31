# TravelAgent-Front

TravelAgent AI 移动端（C 端）—— React + TypeScript + Capacitor 8 安卓应用。

## 项目简介

- **技术栈**：React 18 + TypeScript + Vite 5 + Tailwind CSS 3 + Capacitor 8
- **架构角色**：三人协作项目中的 C 端（移动端），与 B 端（Django 服务器，部署于 39.96.89.133:8000）通过 REST API 通信，行程规划由 A 端 Planner 引擎生成
- **功能**：目的地输入（中英文）、关键词智能推荐（本地城市词库 + Wikipedia 兜底）、出发时间与交通偏好、行程时间线（餐厅多候选点选、交通方式图标）、地图展示（高德中文瓦片、自动缩放、全类别常驻标注）、事件监控轮询（天气/交通/排队）、通知中心、会话本地持久化、中英文双语切换

## 目录结构

```
TravelAgent-Front/
├── src/                     # React 源码
│   ├── components/          # UI 组件（UserInput / ItineraryTimeline / MapView / Pickers / NotificationCenter 等）
│   ├── services/            # api.ts（API 客户端）/ adapter.ts（B 端数据结构适配）/ session.ts（会话持久化）
│   ├── i18n/                # 中英文翻译
│   └── types.ts             # 类型定义（含 B 端契约类型）
├── android/                 # Capacitor 安卓工程（Gradle，SDK 36）
├── .env*                    # 环境配置（mock/真实 API 切换）
├── package.json
└── apk/                     # 历代 APK 发布
    ├── TravelAgentAI-v1.apk  # 首版：基础功能
    ├── TravelAgentAI-v2.apk  # 搜索修复：本地城市词库 + UI 状态显示
    ├── TravelAgentAI-v3.apk  # 通知修复：去除 1 秒延迟
    ├── TravelAgentAI-v4.apk  # 偏好交互优化：点击推荐词直接加入偏好
    └── TravelAgentAI-v5.apk  # UI 全面优化：自定义日期时间选择器、交通方式图标、地图全类别标注、返回键/外链修复、会话持久化
```

## 快速开始

### Web 开发模式

```bash
npm install
npm run dev        # 默认连真实 API（经 vite proxy 转发）
```

### 打包 APK

```bash
npm run build
npx cap sync android
cd android
gradlew assembleDebug --no-daemon --no-build-cache
# 产物：android/app/build/outputs/apk/debug/app-debug.apk
```

### 环境变量

| 文件 | 用途 |
|------|------|
| `.env.development` | `npm run dev` 使用，API 走 vite proxy |
| `.env.production` | `npm run build` 使用，直连 `http://39.96.89.133:8000/api` |
| `.env` | 兜底默认 |

`VITE_USE_MOCK=false` 时走真实 B 端 API；`true` 时使用内置 mock 数据。

## 对接说明（B 端 API）

| 前端动作 | B 端端点 |
|---------|---------|
| 提交规划请求 | `POST /api/plan/` |
| 获取行程 | `GET /api/timeline/` |
| 增量拉取监控事件 | `GET /api/events/?since=N` |
| 获取待确认动作 | `GET /api/actions/` |
| 批准/拒绝动作 | `POST /api/actions/{id}/approve/` `reject/` |
| 手动触发一轮监控 | `POST /api/execution/poll/` |

适配层 `src/services/adapter.ts` 负责 B 端数据结构（TripTimeline/MonitorEvent/ActionItem）与前端类型（Plan/AgentEvent/AgentAction）的双向转换。

## 关联仓库

- B 端（服务器 + 工具层）：https://github.com/Danieltoraji/TravelAgent
