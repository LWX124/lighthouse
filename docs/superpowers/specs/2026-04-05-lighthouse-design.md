# Lighthouse — AI 信息平台设计文档

日期：2026-04-05
Figma 设计稿：https://www.figma.com/design/ksZZivAWRJ4WreRh7PdTDV

## 1. 项目概述

Lighthouse 是一个 AI 驱动的一站式信息平台，覆盖从信息获取到方案落地的完整链路。目标用户包括独立开发者/创业者、AI 从业者（产品经理、运营、技术人员）以及对 AI 感兴趣的泛人群。

商业模式：Freemium — 基础功能免费，高级功能（无限 AI 推荐、方案生成、Opus 模型）付费订阅（¥9.9/月 或 ¥99/年）。

## 2. 系统架构

### 2.1 整体架构：混合架构（Hybrid）

```
用户浏览器
    ↓
Vercel Edge Network (CDN)
    ↓
┌─────────────────────────────────────┐
│  Next.js App (Vercel)               │
│  - 教程板块 (SSG)                    │
│  - AI工具榜 (SSR + ISR)             │
│  - AI新鲜事 (SSR + ISR)             │
│  - 需求Hub / AI实践 (SSR + 动态)     │
│  - API Routes (轻量接口)             │
└──────────────┬──────────────────────┘
               ↓
┌──────────────┴──────────────────────┐
│  Supabase (BaaS)                    │
│  - PostgreSQL 数据库                 │
│  - Auth (JWT + OAuth)               │
│  - Storage 文件存储                  │
│  - Realtime 实时订阅                 │
└──────────────┬──────────────────────┘
               ↓
┌──────────────┴──────────────────────┐
│  Backend Service (独立服务器)         │
│  - Fastify API Server               │
│  - Redis + BullMQ 队列              │
│  - 数据采集 Workers                  │
│  - AI 模型路由层                     │
│  - Claude Agent SDK / CLI           │
└─────────────────────────────────────┘
```

### 2.2 技术栈

| 层级 | 技术选型 |
|------|---------|
| 前端框架 | Next.js 15 (App Router) |
| UI | Tailwind CSS + shadcn/ui |
| 部署（前端） | Vercel |
| 数据库 | Supabase (PostgreSQL) |
| 认证 | Supabase Auth |
| 后端服务 | Fastify (Node.js) |
| 消息队列 | Redis + BullMQ |
| AI（轻量任务） | Anthropic Messages API (@anthropic-ai/sdk) |
| AI（复杂任务） | Claude Agent SDK (@anthropic-ai/claude-agent-sdk) |
| 部署（后端） | Docker on VPS |

### 2.3 渲染策略

| 页面 | 策略 | 原因 |
|------|------|------|
| 教程内容页 | SSG | 内容变化少，性能最优 |
| AI工具榜 | ISR (1h) | 数据每小时更新 |
| AI新鲜事 | ISR (1h) | 数据每小时更新 |
| 需求Hub | SSR + 客户端动态 | 需要实时筛选和排序 |
| AI实践 | SSR + 客户端动态 | 交互式对话 |
| 首页 | ISR (1h) | 聚合各板块预览数据 |

### 2.4 AI 模型路由

| 模型 | 用途 | 成本 (per M tokens) |
|------|------|---------------------|
| Haiku 4.5 | 分类、标签、简单摘要 | $1 / $5 |
| Sonnet 4.6 | 需求分析、工具推荐、内容筛选 | $3 / $15 |
| Opus 4.6 | 方案生成、深度分析（Pro 用户可锁定） | $5 / $25 |

免费用户默认使用 Sonnet，Pro 用户可选择锁定 Opus。

## 3. 数据库设计

### 3.1 用户体系

- `profiles` — 用户资料（display_name, avatar_url, role, preferences），FK 到 Supabase Auth
- `subscriptions` — 订阅信息（plan: free|pro, status, stripe_sub_id, current_period_start/end）
- `user_usage` — 每日用量追踪（ai_requests, plan_generations, tool_searches），用于 Freemium 限流

### 3.2 教程板块

- `categories` — 树形分类（parent_id 自引用，支持无限嵌套），slug 用于 SEO URL
- `tutorials` — 教程内容（category_id FK, title, slug, content MDX, order, is_free, status: draft|published）
- `tutorial_progress` — 用户学习进度（user_id, tutorial_id, completed_at, progress_pct）

### 3.3 AI 工具榜

- `tool_categories` — 工具分类（parent_id 自引用，slug, icon）
- `ai_tools` — 工具信息（name, url, description, logo_url, pricing_model, features JSONB, tags text[], verified）
- `tool_rankings` — 月度排名历史（tool_id, period, monthly_visits, growth_rate, rank, category_rank）
- `tool_bookmarks` — 用户收藏（user_id, tool_id）

### 3.4 AI 新鲜事 & 需求 Hub

- `sources` — 数据源配置（name, type: hn/ph/reddit/rss/x, config JSONB, fetch_interval, is_active）
- `news_items` — 新闻条目（source_id FK, title, url, summary, content, ai_tags text[], ai_summary, engagement_score, published_at）
- `demand_signals` — 需求信号（news_item_id FK, signal_type: pain_point/solution_req/trending, score 0-100, market_size_est, competition_lvl, ai_analysis, status）

### 3.5 AI 实践

- `practice_plans` — 方案记录（user_id, title, input_prompt, status: pending/generating/done, result JSONB, model_used, is_public, download_count）
- `plan_messages` — 对话历史（plan_id FK, role: user|ai, content, created_at）

### 3.6 索引策略

- `news_items`: GIN 索引 on ai_tags + B-tree on published_at
- `ai_tools`: GIN 索引 on features/tags + 全文搜索索引 on name/description
- `demand_signals`: B-tree on score DESC
- `tool_rankings`: 复合索引 (period, category_rank)
- 所有 slug 字段: UNIQUE 索引

## 4. 功能模块设计

### 4.1 教程板块

**页面结构：** 左侧树形分类导航 + 右侧 MDX 内容渲染区

**核心功能：**
- MDX 格式内容，支持 React 组件嵌入（代码块、交互演示等）
- 树形分类支持无限嵌套，新增分类只需数据库添加记录
- SSG 构建时生成静态页，性能最优
- 支持 draft/published 状态控制
- 学习进度追踪（登录用户）

**扩展机制：** 新增教程分类 → categories 表添加记录 → 触发 ISR 重新构建

### 4.2 AI 工具榜

**页面结构：** 顶部 Tab 切换（月度榜/分类榜/增长榜/新工具）+ 左侧分类筛选 + 右侧工具列表

**榜单类型：**
- 月度榜：按月访问量排名，记录历史趋势
- 分类榜：各分类内的 Top 工具
- 增长榜：按月增长率排名，发现新星
- 新工具：最近收录的工具

**AI 找工具（核心差异化功能）：**
1. 用户输入自然语言需求（如"我想做一个AI配音的短视频"）
2. Sonnet 提取关键能力需求（视频生成、AI配音、字幕）
3. 将能力需求与 ai_tools 表的 features/tags 做语义匹配
4. 返回 Top-N 工具 + 推荐理由 + 工具组合建议（workflow）
5. 免费用户每日 3 次，Pro 用户无限

**数据来源：** 人工收录 + 社区提交 + AI 辅助发现。排名数据由后端定时任务每月初计算。

### 4.3 AI 新鲜事

**页面结构：** 顶部来源筛选 pills + 新闻卡片网格

**数据采集频率：**
- HackerNews: 每 2 小时（Algolia API，免费）
- Product Hunt: 每日（GraphQL API v2，免费）
- Reddit: 每 2 小时（OAuth API，100 req/min，免费非商用）
- RSS 源: 每小时（RSSHub 作为通用适配器）
- X: 按预算决定（API 费用高，$200+/月起）
- 公众号: 暂不支持直接采集（无公开 API），考虑 RSS 桥接或手动录入

**AI 增强：** 每条新闻经 Haiku 自动生成 ai_tags 和 ai_summary，前端直接读取，避免实时调用 LLM。

### 4.4 AI 需求 Hub

**页面结构：** 需求信号卡片列表，支持按评分、类型、来源筛选

**需求发现流程：**
1. 数据采集 Workers 从各渠道拉取原始数据 → news_items
2. Sonnet 分析每条内容，识别是否包含需求信号
3. 对识别出的需求信号进行评估：
   - signal_type: 痛点需求 / 解决方案请求 / 趋势需求
   - score (0-100): 综合评分
   - market_size_est: 市场规模估计
   - competition_lvl: 竞争程度
   - ai_analysis: 详细分析文本
4. 高分需求优先展示，支持按维度排序和筛选

**筛选标准（参考 OpenClaw 方法论）：**
- 是否有明确的用户痛点表达
- 是否有付费意愿信号
- 市场规模是否足够
- 现有解决方案的不足之处
- 技术可行性评估

### 4.5 AI 实践

**页面结构：** 聊天式交互界面，支持多轮对话

**方案生成流程：**
1. 用户输入想法/需求描述
2. AI 通过对话澄清需求（替代交互式确认）：
   - 目标用户是谁？
   - 核心功能有哪些？
   - 预算和时间约束？
   - 技术偏好？
3. 结合平台已有数据（工具榜、需求信号、新鲜事）生成方案
4. 方案包含：市场分析、技术方案、执行计划、资源清单
5. 支持下载（PDF/Markdown）和分享

**AI 后端实现：**
- 简单方案生成：Anthropic Messages API + 结构化输出
- 复杂方案（需要文件操作、代码生成）：Claude Agent SDK
- 模型选择：免费用户 Sonnet，Pro 用户可选 Opus
- 每次调用设置 maxBudgetUsd 和 maxTurns 控制成本

### 4.6 Claude Code CLI / Agent SDK 集成

**推荐方案：Claude Agent SDK（优于直接调用 CLI）**

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

// 方案生成任务
for await (const message of query({
  prompt: userInput,
  options: {
    allowedTools: ["Read", "WebSearch", "WebFetch"],
    maxTurns: 15,
    maxBudgetUsd: 2.0,
    permissionMode: "acceptEdits",
    model: userIsPro ? "opus" : "sonnet",
  },
})) {
  // 流式返回给前端
}
```

**使用场景：**
- 方案生成（AI 实践板块）：需要多轮推理和结构化输出
- 需求深度分析：需要联网搜索和信息综合
- 教程内容辅助生成：需要代码生成和验证

**部署要求：**
- 后端服务器安装 Claude Code CLI
- Docker 容器化运行，ANTHROPIC_API_KEY 环境变量认证
- 每个请求隔离工作目录，避免并发冲突

## 5. 数据采集架构

### 5.1 采集 Workers

```
BullMQ 队列
├── collect:hackernews  (每 2h, Algolia API)
├── collect:producthunt (每日, GraphQL API)
├── collect:reddit      (每 2h, OAuth API)
├── collect:rss         (每 1h, RSSHub + feedparser)
└── collect:x           (按预算, Official API)
```

每个 Worker 职责：
1. 从数据源拉取新内容
2. 去重（URL 唯一约束）
3. 写入 news_items 表
4. 触发 AI 处理队列

### 5.2 AI 处理队列

```
BullMQ 队列
├── ai:tag-and-summarize  (Haiku, 批量处理)
├── ai:demand-analysis    (Sonnet, 逐条分析)
└── ai:plan-generation    (Sonnet/Opus, 按需)
```

### 5.3 参考工具

- RSSHub: 通用 RSS 适配器，支持数百个非 RSS 源
- Miniflux: 轻量 RSS 聚合器，可选用于统一管理 RSS 源

## 6. Freemium 权限设计

| 功能 | 免费版 | Pro (¥9.9/月) |
|------|--------|---------------|
| 浏览所有内容 | ✅ | ✅ |
| 基础搜索 | ✅ | ✅ |
| AI 工具推荐 | 3次/日 | 无限 |
| AI 方案生成 | 1次/日 | 无限 |
| 需求信号查看 | Top 10 | 全部 |
| 高级筛选/排序 | ❌ | ✅ |
| 默认模型 | Sonnet | Sonnet (可选 Opus) |
| 方案下载 | ❌ | ✅ (PDF/MD) |

限流实现：`user_usage` 表按日记录，API 层中间件检查。

## 7. 部署方案

### 7.1 前端 (Vercel)
- Next.js App 自动部署
- Edge Network CDN 全球加速
- ISR 增量静态再生
- Vercel Analytics 性能监控

### 7.2 后端 (VPS)
- Docker Compose 编排：Fastify + Redis + Claude Code CLI
- 推荐：AWS EC2 / 阿里云 ECS (4C8G 起步)
- Nginx 反向代理 + Let's Encrypt SSL
- PM2 或 Docker restart policy 保活

### 7.3 数据存储
- Supabase Cloud (PostgreSQL + Auth + Storage + Realtime)
- Redis: 后端服务器本地部署（队列 + 缓存 + 会话）

## 8. 参考网站

| 模块 | 参考 | 借鉴点 |
|------|------|--------|
| 教程 | promptingguide.ai | Next.js + Nextra 文档式教程，分类清晰 |
| 教程 | learnprompting.org | Docusaurus 侧边栏导航，交互示例 |
| 工具榜 | toolify.ai | 多维度排名（月度/分类/增长/收入） |
| 工具榜 | theresanaiforthat.com | 任务导向搜索，Requests 功能 |
| 新鲜事 | news.bensbites.com | 多源聚合 + 来源标注 + 社区投票 |
| 新鲜事 | techmeme.com | 故事聚类，算法+人工混合策略 |
| 需求Hub | explodintopics.com | 趋势增长曲线可视化 |
| 需求Hub | subredditsignals.com | 买家意图分类框架 |
| AI实践 | clickup.com/features/ai | 自然语言输入 → 结构化方案输出 |
