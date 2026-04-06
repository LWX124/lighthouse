# Backend Services Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone Fastify backend service with Redis + BullMQ for data collection workers and AI processing pipelines that feed the existing `sources`, `news_items`, and `demand_signals` tables.

**Architecture:** The backend lives in `services/backend/` as a separate pnpm workspace package. It runs independently from the Next.js app, connecting directly to Supabase via service role key. BullMQ manages job scheduling (collect workers) and AI processing queues (tag/summarize, demand analysis). A Fastify HTTP server exposes health checks, admin endpoints, and a Bull Board dashboard.

**Tech Stack:** Fastify 5, BullMQ 5, ioredis 5, @supabase/supabase-js, @anthropic-ai/sdk, tsx (dev runner), vitest (tests)

---

## File Structure

```
services/backend/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                    # Fastify server entry point
│   ├── config.ts                   # Environment config with validation
│   ├── lib/
│   │   ├── supabase.ts             # Service-role Supabase client
│   │   ├── redis.ts                # Shared ioredis connection
│   │   └── anthropic.ts            # Anthropic SDK client
│   ├── queues/
│   │   ├── registry.ts             # Central queue/worker registry
│   │   ├── collect-hn.ts           # HackerNews collector
│   │   ├── collect-ph.ts           # Product Hunt collector
│   │   ├── collect-reddit.ts       # Reddit collector
│   │   ├── collect-rss.ts          # RSS collector
│   │   ├── ai-tag-summarize.ts     # Haiku: tag + summarize news
│   │   └── ai-demand-analysis.ts   # Sonnet: demand signal extraction
│   └── routes/
│       └── health.ts               # Health + status routes
├── tests/
│   ├── config.test.ts
│   ├── collect-hn.test.ts
│   ├── collect-ph.test.ts
│   ├── collect-reddit.test.ts
│   ├── collect-rss.test.ts
│   ├── ai-tag-summarize.test.ts
│   └── ai-demand-analysis.test.ts
└── Dockerfile
```

---

### Task 1: Workspace 设置 + 后端项目脚手架

**Files:**
- Modify: `pnpm-workspace.yaml`
- Create: `services/backend/package.json`
- Create: `services/backend/tsconfig.json`

- [ ] **Step 1: 更新 pnpm workspace 配置**

Edit `pnpm-workspace.yaml` to add workspace packages:

```yaml
packages:
  - "services/*"
ignoredBuiltDependencies:
  - sharp
  - unrs-resolver
```

- [ ] **Step 2: 创建后端 package.json**

Create `services/backend/package.json`:

```json
{
  "name": "@lighthouse/backend",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "node --import tsx src/index.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.52.0",
    "@supabase/supabase-js": "^2.101.1",
    "bullmq": "^5.34.0",
    "fastify": "^5.3.2",
    "ioredis": "^5.6.1",
    "rss-parser": "^3.13.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "@types/node": "^20",
    "tsx": "^4.19.0",
    "typescript": "^5",
    "vitest": "^4.1.2"
  }
}
```

- [ ] **Step 3: 创建 tsconfig.json**

Create `services/backend/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "sourceMap": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 4: 安装依赖**

```bash
cd services/backend && pnpm install
```

- [ ] **Step 5: 验证 workspace 结构**

```bash
cd /Users/lwx/Workspace/partime/lighthouse && pnpm ls --depth=0 --filter @lighthouse/backend
```

Expected: 列出 @lighthouse/backend 及其依赖

- [ ] **Step 6: 提交**

```bash
git add pnpm-workspace.yaml services/backend/package.json services/backend/tsconfig.json services/backend/pnpm-lock.yaml pnpm-lock.yaml
git commit -m "feat: scaffold backend service workspace with Fastify + BullMQ"
```

---

### Task 2: 配置模块 + 共享客户端

**Files:**
- Create: `services/backend/src/config.ts`
- Create: `services/backend/src/lib/supabase.ts`
- Create: `services/backend/src/lib/redis.ts`
- Create: `services/backend/src/lib/anthropic.ts`
- Create: `services/backend/tests/config.test.ts`

- [ ] **Step 1: 编写配置验证测试**

Create `services/backend/tests/config.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("config", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("throws when SUPABASE_URL is missing", async () => {
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-key");
    vi.stubEnv("REDIS_URL", "redis://localhost:6379");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");

    const { loadConfig } = await import("../src/config.ts");
    expect(() => loadConfig()).toThrow();
  });

  it("loads valid config from env", async () => {
    vi.stubEnv("SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key");
    vi.stubEnv("REDIS_URL", "redis://localhost:6379");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test-key");
    vi.stubEnv("PORT", "4000");

    const { loadConfig } = await import("../src/config.ts");
    const config = loadConfig();

    expect(config.supabaseUrl).toBe("https://test.supabase.co");
    expect(config.supabaseServiceRoleKey).toBe("test-service-key");
    expect(config.redisUrl).toBe("redis://localhost:6379");
    expect(config.anthropicApiKey).toBe("sk-ant-test-key");
    expect(config.port).toBe(4000);
  });

  it("uses default port 3001 when PORT is not set", async () => {
    vi.stubEnv("SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key");
    vi.stubEnv("REDIS_URL", "redis://localhost:6379");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test-key");

    const { loadConfig } = await import("../src/config.ts");
    const config = loadConfig();
    expect(config.port).toBe(3001);
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `cd services/backend && npx vitest run tests/config.test.ts`
Expected: FAIL — 模块未找到

- [ ] **Step 3: 实现配置模块**

Create `services/backend/src/config.ts`:

```typescript
import { z } from "zod";

const envSchema = z.object({
  SUPABASE_URL: z.string().url().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  REDIS_URL: z.string().min(1).default("redis://localhost:6379"),
  ANTHROPIC_API_KEY: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3001),
});

export interface AppConfig {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  redisUrl: string;
  anthropicApiKey: string;
  port: number;
}

export function loadConfig(): AppConfig {
  const parsed = envSchema.parse(process.env);
  return {
    supabaseUrl: parsed.SUPABASE_URL,
    supabaseServiceRoleKey: parsed.SUPABASE_SERVICE_ROLE_KEY,
    redisUrl: parsed.REDIS_URL,
    anthropicApiKey: parsed.ANTHROPIC_API_KEY,
    port: parsed.PORT,
  };
}
```

- [ ] **Step 4: 实现共享客户端**

Create `services/backend/src/lib/supabase.ts`:

```typescript
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function getSupabase(url: string, serviceRoleKey: string): SupabaseClient {
  if (!client) {
    client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
```

Create `services/backend/src/lib/redis.ts`:

```typescript
import Redis from "ioredis";

let connection: Redis | null = null;

export function getRedis(url: string): Redis {
  if (!connection) {
    connection = new Redis(url, { maxRetriesPerRequest: null });
  }
  return connection;
}

export async function closeRedis(): Promise<void> {
  if (connection) {
    await connection.quit();
    connection = null;
  }
}
```

Create `services/backend/src/lib/anthropic.ts`:

```typescript
import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export function getAnthropic(apiKey: string): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey });
  }
  return client;
}
```

- [ ] **Step 5: 运行测试，确认通过**

Run: `cd services/backend && npx vitest run tests/config.test.ts`
Expected: 3 tests PASS

- [ ] **Step 6: 提交**

```bash
git add services/backend/src/config.ts services/backend/src/lib/ services/backend/tests/config.test.ts
git commit -m "feat: add config validation and shared Supabase/Redis/Anthropic clients"
```

---

### Task 3: Fastify 服务器 + 健康检查路由

**Files:**
- Create: `services/backend/src/routes/health.ts`
- Create: `services/backend/src/index.ts`

- [ ] **Step 1: 创建健康检查路由**

Create `services/backend/src/routes/health.ts`:

```typescript
import type { FastifyInstance } from "fastify";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => {
    return { status: "ok", timestamp: new Date().toISOString() };
  });

  app.get("/health/ready", async () => {
    // Future: check Redis + Supabase connectivity
    return { status: "ready", timestamp: new Date().toISOString() };
  });
}
```

- [ ] **Step 2: 创建服务器入口**

Create `services/backend/src/index.ts`:

```typescript
import Fastify from "fastify";
import { loadConfig } from "./config.js";
import { healthRoutes } from "./routes/health.js";
import { getRedis, closeRedis } from "./lib/redis.js";
import { registerQueues, closeQueues } from "./queues/registry.js";

async function main() {
  const config = loadConfig();

  const app = Fastify({ logger: true });

  // Routes
  await app.register(healthRoutes);

  // Initialize Redis connection
  const redis = getRedis(config.redisUrl);

  // Register queues and workers
  await registerQueues(config);

  // Graceful shutdown
  const shutdown = async () => {
    app.log.info("Shutting down...");
    await closeQueues();
    await closeRedis();
    await app.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Start server
  await app.listen({ port: config.port, host: "0.0.0.0" });
  app.log.info(`Backend service running on port ${config.port}`);
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
```

- [ ] **Step 3: 创建队列注册占位（后续 Task 填充）**

Create `services/backend/src/queues/registry.ts`:

```typescript
import type { AppConfig } from "../config.js";

const workers: Array<{ close: () => Promise<void> }> = [];

export async function registerQueues(config: AppConfig): Promise<void> {
  console.log("Queue registration placeholder — workers will be added in subsequent tasks");
}

export async function closeQueues(): Promise<void> {
  await Promise.all(workers.map((w) => w.close()));
  workers.length = 0;
}

export function trackWorker(worker: { close: () => Promise<void> }): void {
  workers.push(worker);
}
```

- [ ] **Step 4: 提交**

```bash
git add services/backend/src/index.ts services/backend/src/routes/ services/backend/src/queues/registry.ts
git commit -m "feat: add Fastify server with health routes and queue registry skeleton"
```

---

### Task 4: HackerNews 采集 Worker

**Files:**
- Create: `services/backend/src/queues/collect-hn.ts`
- Create: `services/backend/tests/collect-hn.test.ts`

- [ ] **Step 1: 编写测试**

Create `services/backend/tests/collect-hn.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { parseHNStories } from "../src/queues/collect-hn.js";

const mockHNResponse = {
  hits: [
    {
      objectID: "111",
      title: "Show HN: AI Code Review Tool",
      url: "https://example.com/ai-code-review",
      points: 150,
      created_at_i: 1743897600,
      _tags: ["story", "show_hn"],
    },
    {
      objectID: "222",
      title: "Ask HN: Best AI tools for startups?",
      url: null,
      points: 89,
      created_at_i: 1743894000,
      _tags: ["story", "ask_hn"],
    },
    {
      objectID: "333",
      title: "OpenAI Announces GPT-5",
      url: "https://openai.com/gpt5",
      points: 342,
      created_at_i: 1743890400,
      _tags: ["story"],
    },
  ],
};

describe("parseHNStories", () => {
  it("parses stories with external URLs", () => {
    const items = parseHNStories(mockHNResponse.hits, "source-1");
    expect(items).toHaveLength(3);
    expect(items[0]).toEqual({
      source_id: "source-1",
      title: "Show HN: AI Code Review Tool",
      url: "https://example.com/ai-code-review",
      summary: null,
      content: null,
      ai_tags: [],
      ai_summary: null,
      engagement_score: 150,
      published_at: new Date(1743897600 * 1000).toISOString(),
    });
  });

  it("falls back to HN comment URL when no external URL", () => {
    const items = parseHNStories(mockHNResponse.hits, "source-1");
    expect(items[1].url).toBe("https://news.ycombinator.com/item?id=222");
  });

  it("uses points as engagement_score", () => {
    const items = parseHNStories(mockHNResponse.hits, "source-1");
    expect(items[2].engagement_score).toBe(342);
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `cd services/backend && npx vitest run tests/collect-hn.test.ts`
Expected: FAIL — 模块未找到

- [ ] **Step 3: 实现 HackerNews 采集器**

Create `services/backend/src/queues/collect-hn.ts`:

```typescript
import { Queue, Worker } from "bullmq";
import type { AppConfig } from "../config.js";
import { getSupabase } from "../lib/supabase.js";
import { getRedis } from "../lib/redis.js";
import { trackWorker } from "./registry.js";

interface HNHit {
  objectID: string;
  title: string;
  url: string | null;
  points: number;
  created_at_i: number;
  _tags: string[];
}

interface NewsItemInsert {
  source_id: string;
  title: string;
  url: string;
  summary: string | null;
  content: string | null;
  ai_tags: string[];
  ai_summary: string | null;
  engagement_score: number;
  published_at: string;
}

export function parseHNStories(hits: HNHit[], sourceId: string): NewsItemInsert[] {
  return hits.map((hit) => ({
    source_id: sourceId,
    title: hit.title,
    url: hit.url ?? `https://news.ycombinator.com/item?id=${hit.objectID}`,
    summary: null,
    content: null,
    ai_tags: [],
    ai_summary: null,
    engagement_score: hit.points,
    published_at: new Date(hit.created_at_i * 1000).toISOString(),
  }));
}

async function fetchHNFrontPage(): Promise<HNHit[]> {
  const url =
    "https://hn.algolia.com/api/v1/search?tags=story&hitsPerPage=30&numericFilters=points>20";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HN API error: ${res.status}`);
  const data = await res.json();
  return data.hits as HNHit[];
}

export function setupHNCollector(config: AppConfig): { queue: Queue; worker: Worker } {
  const connection = getRedis(config.redisUrl);

  const queue = new Queue("collect:hackernews", { connection });

  const worker = new Worker(
    "collect:hackernews",
    async () => {
      const supabase = getSupabase(config.supabaseUrl, config.supabaseServiceRoleKey);

      // Find the HN source record
      const { data: source } = await supabase
        .from("sources")
        .select("id")
        .eq("type", "hn")
        .eq("is_active", true)
        .single();

      if (!source) {
        console.warn("No active HN source configured");
        return { collected: 0 };
      }

      const hits = await fetchHNFrontPage();
      const items = parseHNStories(hits, source.id);

      // Upsert — URL has UNIQUE constraint, so conflicts are ignored
      const { data, error } = await supabase
        .from("news_items")
        .upsert(items, { onConflict: "url", ignoreDuplicates: true })
        .select("id");

      if (error) throw error;
      const inserted = data?.length ?? 0;
      console.log(`HN: collected ${hits.length} stories, ${inserted} new`);
      return { collected: hits.length, inserted };
    },
    { connection }
  );

  // Schedule repeating job: every 2 hours
  queue.upsertJobScheduler("hn-repeat", {
    every: 2 * 60 * 60 * 1000, // 2h in ms
  }, {
    name: "collect-hn",
  });

  trackWorker(worker);
  return { queue, worker };
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `cd services/backend && npx vitest run tests/collect-hn.test.ts`
Expected: 3 tests PASS

- [ ] **Step 5: 提交**

```bash
git add services/backend/src/queues/collect-hn.ts services/backend/tests/collect-hn.test.ts
git commit -m "feat: add HackerNews collector worker with Algolia API"
```

---

### Task 5: Product Hunt 采集 Worker

**Files:**
- Create: `services/backend/src/queues/collect-ph.ts`
- Create: `services/backend/tests/collect-ph.test.ts`

- [ ] **Step 1: 编写测试**

Create `services/backend/tests/collect-ph.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parsePHPosts } from "../src/queues/collect-ph.js";

const mockPHPosts = [
  {
    id: "post-1",
    name: "CodePilot AI",
    tagline: "AI-powered code completion for VS Code",
    url: "https://www.producthunt.com/posts/codepilot-ai",
    website: "https://codepilot.ai",
    votesCount: 523,
    createdAt: "2026-04-05T08:00:00Z",
    topics: { edges: [{ node: { name: "Artificial Intelligence" } }, { node: { name: "Developer Tools" } }] },
  },
  {
    id: "post-2",
    name: "DesignAI",
    tagline: "Generate UI designs from text descriptions",
    url: "https://www.producthunt.com/posts/designai",
    website: "https://designai.com",
    votesCount: 312,
    createdAt: "2026-04-05T10:00:00Z",
    topics: { edges: [{ node: { name: "Design Tools" } }] },
  },
];

describe("parsePHPosts", () => {
  it("parses PH posts into news items", () => {
    const items = parsePHPosts(mockPHPosts, "source-ph");
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({
      source_id: "source-ph",
      title: "CodePilot AI",
      url: "https://codepilot.ai",
      summary: "AI-powered code completion for VS Code",
      content: null,
      ai_tags: [],
      ai_summary: null,
      engagement_score: 523,
      published_at: "2026-04-05T08:00:00Z",
    });
  });

  it("falls back to PH URL when no website", () => {
    const posts = [{ ...mockPHPosts[0], website: null }];
    const items = parsePHPosts(posts, "source-ph");
    expect(items[0].url).toBe("https://www.producthunt.com/posts/codepilot-ai");
  });

  it("uses votesCount as engagement_score", () => {
    const items = parsePHPosts(mockPHPosts, "source-ph");
    expect(items[1].engagement_score).toBe(312);
  });

  it("uses tagline as summary", () => {
    const items = parsePHPosts(mockPHPosts, "source-ph");
    expect(items[0].summary).toBe("AI-powered code completion for VS Code");
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `cd services/backend && npx vitest run tests/collect-ph.test.ts`
Expected: FAIL — 模块未找到

- [ ] **Step 3: 实现 Product Hunt 采集器**

Create `services/backend/src/queues/collect-ph.ts`:

```typescript
import { Queue, Worker } from "bullmq";
import type { AppConfig } from "../config.js";
import { getSupabase } from "../lib/supabase.js";
import { getRedis } from "../lib/redis.js";
import { trackWorker } from "./registry.js";

interface PHPost {
  id: string;
  name: string;
  tagline: string;
  url: string;
  website: string | null;
  votesCount: number;
  createdAt: string;
  topics: { edges: Array<{ node: { name: string } }> };
}

interface NewsItemInsert {
  source_id: string;
  title: string;
  url: string;
  summary: string | null;
  content: string | null;
  ai_tags: string[];
  ai_summary: string | null;
  engagement_score: number;
  published_at: string;
}

export function parsePHPosts(posts: PHPost[], sourceId: string): NewsItemInsert[] {
  return posts.map((post) => ({
    source_id: sourceId,
    title: post.name,
    url: post.website ?? post.url,
    summary: post.tagline,
    content: null,
    ai_tags: [],
    ai_summary: null,
    engagement_score: post.votesCount,
    published_at: post.createdAt,
  }));
}

const PH_GRAPHQL_URL = "https://api.producthunt.com/v2/api/graphql";

const PH_QUERY = `
  query {
    posts(order: VOTES, first: 20) {
      edges {
        node {
          id
          name
          tagline
          url
          website
          votesCount
          createdAt
          topics(first: 3) {
            edges { node { name } }
          }
        }
      }
    }
  }
`;

async function fetchPHPosts(config: AppConfig): Promise<PHPost[]> {
  const phToken = process.env.PH_API_TOKEN;
  if (!phToken) {
    console.warn("PH_API_TOKEN not set, skipping Product Hunt collection");
    return [];
  }

  const res = await fetch(PH_GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${phToken}`,
    },
    body: JSON.stringify({ query: PH_QUERY }),
  });

  if (!res.ok) throw new Error(`PH API error: ${res.status}`);
  const data = await res.json();
  return data.data.posts.edges.map((e: { node: PHPost }) => e.node);
}

export function setupPHCollector(config: AppConfig): { queue: Queue; worker: Worker } {
  const connection = getRedis(config.redisUrl);

  const queue = new Queue("collect:producthunt", { connection });

  const worker = new Worker(
    "collect:producthunt",
    async () => {
      const supabase = getSupabase(config.supabaseUrl, config.supabaseServiceRoleKey);

      const { data: source } = await supabase
        .from("sources")
        .select("id")
        .eq("type", "ph")
        .eq("is_active", true)
        .single();

      if (!source) {
        console.warn("No active PH source configured");
        return { collected: 0 };
      }

      const posts = await fetchPHPosts(config);
      if (posts.length === 0) return { collected: 0 };

      const items = parsePHPosts(posts, source.id);

      const { data, error } = await supabase
        .from("news_items")
        .upsert(items, { onConflict: "url", ignoreDuplicates: true })
        .select("id");

      if (error) throw error;
      const inserted = data?.length ?? 0;
      console.log(`PH: collected ${posts.length} posts, ${inserted} new`);
      return { collected: posts.length, inserted };
    },
    { connection }
  );

  // Schedule: once daily
  queue.upsertJobScheduler("ph-repeat", {
    every: 24 * 60 * 60 * 1000, // 24h
  }, {
    name: "collect-ph",
  });

  trackWorker(worker);
  return { queue, worker };
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `cd services/backend && npx vitest run tests/collect-ph.test.ts`
Expected: 4 tests PASS

- [ ] **Step 5: 提交**

```bash
git add services/backend/src/queues/collect-ph.ts services/backend/tests/collect-ph.test.ts
git commit -m "feat: add Product Hunt collector worker with GraphQL API"
```

---

### Task 6: Reddit 采集 Worker

**Files:**
- Create: `services/backend/src/queues/collect-reddit.ts`
- Create: `services/backend/tests/collect-reddit.test.ts`

- [ ] **Step 1: 编写测试**

Create `services/backend/tests/collect-reddit.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parseRedditPosts } from "../src/queues/collect-reddit.js";

const mockRedditPosts = [
  {
    id: "abc123",
    title: "[D] New breakthrough in AI alignment research",
    url: "https://arxiv.org/abs/1234.5678",
    selftext: "This paper proposes a novel approach...",
    score: 456,
    created_utc: 1743897600,
    subreddit: "MachineLearning",
    permalink: "/r/MachineLearning/comments/abc123/new_breakthrough/",
    is_self: false,
  },
  {
    id: "def456",
    title: "What AI tools are you using for coding in 2026?",
    url: "https://www.reddit.com/r/artificial/comments/def456/what_ai_tools/",
    selftext: "I'm curious what everyone is using...",
    score: 234,
    created_utc: 1743894000,
    subreddit: "artificial",
    permalink: "/r/artificial/comments/def456/what_ai_tools/",
    is_self: true,
  },
];

describe("parseRedditPosts", () => {
  it("parses reddit posts into news items", () => {
    const items = parseRedditPosts(mockRedditPosts, "source-reddit");
    expect(items).toHaveLength(2);
    expect(items[0].title).toBe("[D] New breakthrough in AI alignment research");
    expect(items[0].url).toBe("https://arxiv.org/abs/1234.5678");
    expect(items[0].engagement_score).toBe(456);
  });

  it("uses reddit permalink for self posts", () => {
    const items = parseRedditPosts(mockRedditPosts, "source-reddit");
    expect(items[1].url).toBe("https://www.reddit.com/r/artificial/comments/def456/what_ai_tools/");
  });

  it("uses selftext as summary for self posts", () => {
    const items = parseRedditPosts(mockRedditPosts, "source-reddit");
    expect(items[1].summary).toBe("I'm curious what everyone is using...");
  });

  it("sets null summary for link posts", () => {
    const items = parseRedditPosts(mockRedditPosts, "source-reddit");
    expect(items[0].summary).toBeNull();
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `cd services/backend && npx vitest run tests/collect-reddit.test.ts`
Expected: FAIL — 模块未找到

- [ ] **Step 3: 实现 Reddit 采集器**

Create `services/backend/src/queues/collect-reddit.ts`:

```typescript
import { Queue, Worker } from "bullmq";
import type { AppConfig } from "../config.js";
import { getSupabase } from "../lib/supabase.js";
import { getRedis } from "../lib/redis.js";
import { trackWorker } from "./registry.js";

interface RedditPost {
  id: string;
  title: string;
  url: string;
  selftext: string;
  score: number;
  created_utc: number;
  subreddit: string;
  permalink: string;
  is_self: boolean;
}

interface NewsItemInsert {
  source_id: string;
  title: string;
  url: string;
  summary: string | null;
  content: string | null;
  ai_tags: string[];
  ai_summary: string | null;
  engagement_score: number;
  published_at: string;
}

const AI_SUBREDDITS = [
  "MachineLearning",
  "artificial",
  "LocalLLaMA",
  "singularity",
  "ChatGPT",
];

export function parseRedditPosts(posts: RedditPost[], sourceId: string): NewsItemInsert[] {
  return posts.map((post) => ({
    source_id: sourceId,
    title: post.title,
    url: post.is_self
      ? `https://www.reddit.com${post.permalink}`
      : post.url,
    summary: post.is_self && post.selftext ? post.selftext.slice(0, 500) : null,
    content: null,
    ai_tags: [],
    ai_summary: null,
    engagement_score: post.score,
    published_at: new Date(post.created_utc * 1000).toISOString(),
  }));
}

async function fetchRedditPosts(): Promise<RedditPost[]> {
  const allPosts: RedditPost[] = [];

  for (const sub of AI_SUBREDDITS) {
    try {
      const res = await fetch(
        `https://www.reddit.com/r/${sub}/hot.json?limit=10`,
        {
          headers: {
            "User-Agent": "lighthouse-backend/0.1 (data collection bot)",
          },
        }
      );

      if (!res.ok) {
        console.warn(`Reddit r/${sub} fetch failed: ${res.status}`);
        continue;
      }

      const data = await res.json();
      const posts = data.data.children
        .map((c: { data: RedditPost }) => c.data)
        .filter((p: RedditPost) => p.score > 10);

      allPosts.push(...posts);
    } catch (err) {
      console.warn(`Reddit r/${sub} error:`, err);
    }
  }

  return allPosts;
}

export function setupRedditCollector(config: AppConfig): { queue: Queue; worker: Worker } {
  const connection = getRedis(config.redisUrl);

  const queue = new Queue("collect:reddit", { connection });

  const worker = new Worker(
    "collect:reddit",
    async () => {
      const supabase = getSupabase(config.supabaseUrl, config.supabaseServiceRoleKey);

      const { data: source } = await supabase
        .from("sources")
        .select("id")
        .eq("type", "reddit")
        .eq("is_active", true)
        .single();

      if (!source) {
        console.warn("No active Reddit source configured");
        return { collected: 0 };
      }

      const posts = await fetchRedditPosts();
      if (posts.length === 0) return { collected: 0 };

      const items = parseRedditPosts(posts, source.id);

      const { data, error } = await supabase
        .from("news_items")
        .upsert(items, { onConflict: "url", ignoreDuplicates: true })
        .select("id");

      if (error) throw error;
      const inserted = data?.length ?? 0;
      console.log(`Reddit: collected ${posts.length} posts, ${inserted} new`);
      return { collected: posts.length, inserted };
    },
    { connection }
  );

  // Schedule: every 2 hours
  queue.upsertJobScheduler("reddit-repeat", {
    every: 2 * 60 * 60 * 1000,
  }, {
    name: "collect-reddit",
  });

  trackWorker(worker);
  return { queue, worker };
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `cd services/backend && npx vitest run tests/collect-reddit.test.ts`
Expected: 4 tests PASS

- [ ] **Step 5: 提交**

```bash
git add services/backend/src/queues/collect-reddit.ts services/backend/tests/collect-reddit.test.ts
git commit -m "feat: add Reddit collector worker for AI subreddits"
```

---

### Task 7: RSS 采集 Worker

**Files:**
- Create: `services/backend/src/queues/collect-rss.ts`
- Create: `services/backend/tests/collect-rss.test.ts`

- [ ] **Step 1: 编写测试**

Create `services/backend/tests/collect-rss.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parseRSSItems } from "../src/queues/collect-rss.js";

const mockRSSItems = [
  {
    title: "The Future of AI Agents",
    link: "https://blog.example.com/ai-agents",
    contentSnippet: "AI agents are transforming how we interact with software...",
    isoDate: "2026-04-05T12:00:00Z",
  },
  {
    title: "Building with Claude Agent SDK",
    link: "https://blog.example.com/claude-sdk",
    contentSnippet: "A deep dive into the Claude Agent SDK for building autonomous agents.",
    isoDate: "2026-04-04T08:30:00Z",
  },
  {
    title: "Post without date",
    link: "https://blog.example.com/no-date",
    contentSnippet: "This post has no date",
    isoDate: undefined,
  },
];

describe("parseRSSItems", () => {
  it("parses RSS items into news items", () => {
    const items = parseRSSItems(mockRSSItems, "source-rss");
    expect(items).toHaveLength(3);
    expect(items[0]).toEqual({
      source_id: "source-rss",
      title: "The Future of AI Agents",
      url: "https://blog.example.com/ai-agents",
      summary: "AI agents are transforming how we interact with software...",
      content: null,
      ai_tags: [],
      ai_summary: null,
      engagement_score: 0,
      published_at: "2026-04-05T12:00:00Z",
    });
  });

  it("uses contentSnippet as summary", () => {
    const items = parseRSSItems(mockRSSItems, "source-rss");
    expect(items[1].summary).toBe(
      "A deep dive into the Claude Agent SDK for building autonomous agents."
    );
  });

  it("uses current time when isoDate is missing", () => {
    const before = new Date().toISOString();
    const items = parseRSSItems(mockRSSItems, "source-rss");
    const after = new Date().toISOString();
    expect(items[2].published_at >= before).toBe(true);
    expect(items[2].published_at <= after).toBe(true);
  });

  it("sets engagement_score to 0 for RSS items", () => {
    const items = parseRSSItems(mockRSSItems, "source-rss");
    expect(items[0].engagement_score).toBe(0);
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `cd services/backend && npx vitest run tests/collect-rss.test.ts`
Expected: FAIL — 模块未找到

- [ ] **Step 3: 实现 RSS 采集器**

Create `services/backend/src/queues/collect-rss.ts`:

```typescript
import { Queue, Worker } from "bullmq";
import Parser from "rss-parser";
import type { AppConfig } from "../config.js";
import { getSupabase } from "../lib/supabase.js";
import { getRedis } from "../lib/redis.js";
import { trackWorker } from "./registry.js";

interface RSSItem {
  title?: string;
  link?: string;
  contentSnippet?: string;
  isoDate?: string;
}

interface NewsItemInsert {
  source_id: string;
  title: string;
  url: string;
  summary: string | null;
  content: string | null;
  ai_tags: string[];
  ai_summary: string | null;
  engagement_score: number;
  published_at: string;
}

export function parseRSSItems(items: RSSItem[], sourceId: string): NewsItemInsert[] {
  return items
    .filter((item) => item.title && item.link)
    .map((item) => ({
      source_id: sourceId,
      title: item.title!,
      url: item.link!,
      summary: item.contentSnippet?.slice(0, 500) ?? null,
      content: null,
      ai_tags: [],
      ai_summary: null,
      engagement_score: 0,
      published_at: item.isoDate ?? new Date().toISOString(),
    }));
}

export function setupRSSCollector(config: AppConfig): { queue: Queue; worker: Worker } {
  const connection = getRedis(config.redisUrl);
  const parser = new Parser();

  const queue = new Queue("collect:rss", { connection });

  const worker = new Worker(
    "collect:rss",
    async () => {
      const supabase = getSupabase(config.supabaseUrl, config.supabaseServiceRoleKey);

      // Get all active RSS sources
      const { data: sources } = await supabase
        .from("sources")
        .select("id, config")
        .eq("type", "rss")
        .eq("is_active", true);

      if (!sources || sources.length === 0) {
        console.warn("No active RSS sources configured");
        return { collected: 0 };
      }

      let totalCollected = 0;
      let totalInserted = 0;

      for (const source of sources) {
        const feedUrl = (source.config as { url?: string })?.url;
        if (!feedUrl) {
          console.warn(`RSS source ${source.id} has no URL in config`);
          continue;
        }

        try {
          const feed = await parser.parseURL(feedUrl);
          const items = parseRSSItems(feed.items as RSSItem[], source.id);

          if (items.length === 0) continue;

          const { data, error } = await supabase
            .from("news_items")
            .upsert(items, { onConflict: "url", ignoreDuplicates: true })
            .select("id");

          if (error) {
            console.error(`RSS source ${source.id} upsert error:`, error);
            continue;
          }

          const inserted = data?.length ?? 0;
          totalCollected += items.length;
          totalInserted += inserted;
        } catch (err) {
          console.error(`RSS feed ${feedUrl} parse error:`, err);
        }
      }

      console.log(`RSS: collected ${totalCollected} items, ${totalInserted} new`);
      return { collected: totalCollected, inserted: totalInserted };
    },
    { connection }
  );

  // Schedule: every hour
  queue.upsertJobScheduler("rss-repeat", {
    every: 60 * 60 * 1000, // 1h
  }, {
    name: "collect-rss",
  });

  trackWorker(worker);
  return { queue, worker };
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `cd services/backend && npx vitest run tests/collect-rss.test.ts`
Expected: 4 tests PASS

- [ ] **Step 5: 提交**

```bash
git add services/backend/src/queues/collect-rss.ts services/backend/tests/collect-rss.test.ts
git commit -m "feat: add RSS collector worker with rss-parser"
```

---

### Task 8: AI 标签/摘要 Worker (Haiku)

**Files:**
- Create: `services/backend/src/queues/ai-tag-summarize.ts`
- Create: `services/backend/tests/ai-tag-summarize.test.ts`

- [ ] **Step 1: 编写测试**

Create `services/backend/tests/ai-tag-summarize.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildTagPrompt, parseTagResponse } from "../src/queues/ai-tag-summarize.js";

describe("buildTagPrompt", () => {
  it("builds a prompt with the news title and summary", () => {
    const prompt = buildTagPrompt("AI Code Review Tool Launches", "A new tool for reviewing code using AI.");
    expect(prompt).toContain("AI Code Review Tool Launches");
    expect(prompt).toContain("A new tool for reviewing code using AI.");
    expect(prompt).toContain("tags");
    expect(prompt).toContain("summary");
  });

  it("handles missing summary", () => {
    const prompt = buildTagPrompt("AI News Title", null);
    expect(prompt).toContain("AI News Title");
    expect(prompt).toContain("无摘要");
  });
});

describe("parseTagResponse", () => {
  it("parses valid JSON response", () => {
    const response = JSON.stringify({
      tags: ["ai", "code-review", "developer-tools"],
      summary: "一款新的 AI 代码审查工具发布",
    });
    const result = parseTagResponse(response);
    expect(result.tags).toEqual(["ai", "code-review", "developer-tools"]);
    expect(result.summary).toBe("一款新的 AI 代码审查工具发布");
  });

  it("returns empty result for invalid JSON", () => {
    const result = parseTagResponse("not valid json");
    expect(result.tags).toEqual([]);
    expect(result.summary).toBeNull();
  });

  it("limits tags to 5", () => {
    const response = JSON.stringify({
      tags: ["a", "b", "c", "d", "e", "f", "g"],
      summary: "test",
    });
    const result = parseTagResponse(response);
    expect(result.tags).toHaveLength(5);
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `cd services/backend && npx vitest run tests/ai-tag-summarize.test.ts`
Expected: FAIL — 模块未找到

- [ ] **Step 3: 实现 AI 标签/摘要 Worker**

Create `services/backend/src/queues/ai-tag-summarize.ts`:

```typescript
import { Queue, Worker } from "bullmq";
import type { AppConfig } from "../config.js";
import { getSupabase } from "../lib/supabase.js";
import { getRedis } from "../lib/redis.js";
import { getAnthropic } from "../lib/anthropic.js";
import { trackWorker } from "./registry.js";

export function buildTagPrompt(title: string, summary: string | null): string {
  return `你是一个 AI 新闻分析助手。请为以下新闻生成标签和中文摘要。

标题: ${title}
摘要: ${summary ?? "无摘要"}

请以 JSON 格式返回:
{
  "tags": ["标签1", "标签2", ...],  // 3-5 个英文小写标签
  "summary": "一句话中文摘要"
}

只返回 JSON，不要其他内容。`;
}

export function parseTagResponse(text: string): { tags: string[]; summary: string | null } {
  try {
    const data = JSON.parse(text);
    const tags = Array.isArray(data.tags)
      ? data.tags.slice(0, 5).map((t: unknown) => String(t).toLowerCase())
      : [];
    const summary = typeof data.summary === "string" ? data.summary : null;
    return { tags, summary };
  } catch {
    return { tags: [], summary: null };
  }
}

export function setupAITagSummarize(config: AppConfig): { queue: Queue; worker: Worker } {
  const connection = getRedis(config.redisUrl);

  const queue = new Queue("ai:tag-and-summarize", { connection });

  const worker = new Worker(
    "ai:tag-and-summarize",
    async () => {
      const supabase = getSupabase(config.supabaseUrl, config.supabaseServiceRoleKey);
      const anthropic = getAnthropic(config.anthropicApiKey);

      // Find news items without AI tags (empty array) and without AI summary
      const { data: items } = await supabase
        .from("news_items")
        .select("id, title, summary")
        .is("ai_summary", null)
        .eq("ai_tags", "{}")
        .order("created_at", { ascending: false })
        .limit(10);

      if (!items || items.length === 0) {
        console.log("AI Tag: no unprocessed items");
        return { processed: 0 };
      }

      let processed = 0;

      for (const item of items) {
        try {
          const prompt = buildTagPrompt(item.title, item.summary);

          const response = await anthropic.messages.create({
            model: "claude-haiku-4-5-20250414",
            max_tokens: 200,
            messages: [{ role: "user", content: prompt }],
          });

          const text =
            response.content[0].type === "text"
              ? response.content[0].text
              : "";

          const parsed = parseTagResponse(text);

          await supabase
            .from("news_items")
            .update({
              ai_tags: parsed.tags,
              ai_summary: parsed.summary,
            })
            .eq("id", item.id);

          processed++;
        } catch (err) {
          console.error(`AI Tag error for item ${item.id}:`, err);
        }
      }

      console.log(`AI Tag: processed ${processed}/${items.length} items`);
      return { processed };
    },
    { connection, concurrency: 1 }
  );

  // Schedule: every 30 minutes
  queue.upsertJobScheduler("ai-tag-repeat", {
    every: 30 * 60 * 1000,
  }, {
    name: "ai-tag-summarize",
  });

  trackWorker(worker);
  return { queue, worker };
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `cd services/backend && npx vitest run tests/ai-tag-summarize.test.ts`
Expected: 5 tests PASS

- [ ] **Step 5: 提交**

```bash
git add services/backend/src/queues/ai-tag-summarize.ts services/backend/tests/ai-tag-summarize.test.ts
git commit -m "feat: add AI tag and summarize worker using Haiku model"
```

---

### Task 9: AI 需求分析 Worker (Sonnet)

**Files:**
- Create: `services/backend/src/queues/ai-demand-analysis.ts`
- Create: `services/backend/tests/ai-demand-analysis.test.ts`

- [ ] **Step 1: 编写测试**

Create `services/backend/tests/ai-demand-analysis.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildDemandPrompt, parseDemandResponse } from "../src/queues/ai-demand-analysis.js";

describe("buildDemandPrompt", () => {
  it("includes the news title and summary in the prompt", () => {
    const prompt = buildDemandPrompt(
      "Developers frustrated with slow CI/CD pipelines",
      "A survey shows 67% of developers waste 30+ minutes daily on builds."
    );
    expect(prompt).toContain("Developers frustrated");
    expect(prompt).toContain("67% of developers");
  });
});

describe("parseDemandResponse", () => {
  it("parses a valid demand signal response", () => {
    const response = JSON.stringify({
      has_signal: true,
      signal_type: "pain_point",
      score: 82,
      market_size_est: "大型 ($100M+)",
      competition_lvl: "medium",
      ai_analysis: "CI/CD 慢是开发者普遍痛点，市场上已有解决方案但仍有改进空间",
    });
    const result = parseDemandResponse(response);
    expect(result).not.toBeNull();
    expect(result!.signal_type).toBe("pain_point");
    expect(result!.score).toBe(82);
    expect(result!.market_size_est).toBe("大型 ($100M+)");
    expect(result!.competition_lvl).toBe("medium");
  });

  it("returns null when has_signal is false", () => {
    const response = JSON.stringify({ has_signal: false });
    const result = parseDemandResponse(response);
    expect(result).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    const result = parseDemandResponse("not json");
    expect(result).toBeNull();
  });

  it("clamps score to 0-100 range", () => {
    const response = JSON.stringify({
      has_signal: true,
      signal_type: "trending",
      score: 150,
      market_size_est: null,
      competition_lvl: null,
      ai_analysis: "Test",
    });
    const result = parseDemandResponse(response);
    expect(result!.score).toBe(100);
  });

  it("rejects invalid signal_type", () => {
    const response = JSON.stringify({
      has_signal: true,
      signal_type: "invalid_type",
      score: 50,
      market_size_est: null,
      competition_lvl: null,
      ai_analysis: "Test",
    });
    const result = parseDemandResponse(response);
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `cd services/backend && npx vitest run tests/ai-demand-analysis.test.ts`
Expected: FAIL — 模块未找到

- [ ] **Step 3: 实现需求分析 Worker**

Create `services/backend/src/queues/ai-demand-analysis.ts`:

```typescript
import { Queue, Worker } from "bullmq";
import type { AppConfig } from "../config.js";
import { getSupabase } from "../lib/supabase.js";
import { getRedis } from "../lib/redis.js";
import { getAnthropic } from "../lib/anthropic.js";
import { trackWorker } from "./registry.js";

const VALID_SIGNAL_TYPES = ["pain_point", "solution_req", "trending"] as const;
type SignalType = (typeof VALID_SIGNAL_TYPES)[number];

const VALID_COMPETITION_LEVELS = ["low", "medium", "high"] as const;

interface DemandSignalResult {
  signal_type: SignalType;
  score: number;
  market_size_est: string | null;
  competition_lvl: "low" | "medium" | "high" | null;
  ai_analysis: string;
}

export function buildDemandPrompt(title: string, summary: string | null): string {
  return `你是一个市场需求分析专家。请分析以下新闻是否包含值得关注的市场需求信号。

标题: ${title}
摘要: ${summary ?? "无摘要"}

请判断这条新闻是否包含以下类型的需求信号:
- pain_point: 用户/开发者明确表达的痛点
- solution_req: 对特定解决方案的需求
- trending: 正在增长的趋势，暗示未来需求

请以 JSON 格式返回:
{
  "has_signal": true/false,
  "signal_type": "pain_point" | "solution_req" | "trending",
  "score": 0-100,
  "market_size_est": "小型 ($1M-$10M)" | "中型 ($10M-$100M)" | "大型 ($100M+)" | null,
  "competition_lvl": "low" | "medium" | "high" | null,
  "ai_analysis": "中文分析说明，50-100 字"
}

评分标准:
- 80-100: 强烈需求信号，有明确付费意愿或大量用户讨论
- 50-79: 中等信号，有潜在机会但需验证
- 0-49: 弱信号，仅作参考

只返回 JSON，不要其他内容。`;
}

export function parseDemandResponse(text: string): DemandSignalResult | null {
  try {
    const data = JSON.parse(text);

    if (!data.has_signal) return null;

    if (!VALID_SIGNAL_TYPES.includes(data.signal_type)) return null;

    const score = Math.max(0, Math.min(100, Number(data.score) || 0));

    const competitionLvl = VALID_COMPETITION_LEVELS.includes(data.competition_lvl)
      ? data.competition_lvl
      : null;

    return {
      signal_type: data.signal_type,
      score,
      market_size_est: typeof data.market_size_est === "string" ? data.market_size_est : null,
      competition_lvl: competitionLvl,
      ai_analysis: typeof data.ai_analysis === "string" ? data.ai_analysis : "",
    };
  } catch {
    return null;
  }
}

export function setupDemandAnalysis(config: AppConfig): { queue: Queue; worker: Worker } {
  const connection = getRedis(config.redisUrl);

  const queue = new Queue("ai:demand-analysis", { connection });

  const worker = new Worker(
    "ai:demand-analysis",
    async () => {
      const supabase = getSupabase(config.supabaseUrl, config.supabaseServiceRoleKey);
      const anthropic = getAnthropic(config.anthropicApiKey);

      // Find news items with AI tags but no demand analysis yet
      // Use a left join approach: find items not in demand_signals
      const { data: items } = await supabase
        .from("news_items")
        .select("id, title, summary")
        .not("ai_tags", "eq", "{}")
        .order("created_at", { ascending: false })
        .limit(10);

      if (!items || items.length === 0) {
        console.log("Demand Analysis: no items to process");
        return { processed: 0, signals: 0 };
      }

      // Check which items already have demand signals
      const { data: existing } = await supabase
        .from("demand_signals")
        .select("news_item_id")
        .in("news_item_id", items.map((i) => i.id));

      const existingIds = new Set((existing ?? []).map((e) => e.news_item_id));
      const unprocessed = items.filter((i) => !existingIds.has(i.id));

      if (unprocessed.length === 0) {
        console.log("Demand Analysis: all items already processed");
        return { processed: 0, signals: 0 };
      }

      let processed = 0;
      let signals = 0;

      for (const item of unprocessed) {
        try {
          const prompt = buildDemandPrompt(item.title, item.summary);

          const response = await anthropic.messages.create({
            model: "claude-sonnet-4-20250514",
            max_tokens: 300,
            messages: [{ role: "user", content: prompt }],
          });

          const text =
            response.content[0].type === "text"
              ? response.content[0].text
              : "";

          const result = parseDemandResponse(text);
          processed++;

          if (result) {
            await supabase.from("demand_signals").insert({
              news_item_id: item.id,
              signal_type: result.signal_type,
              score: result.score,
              market_size_est: result.market_size_est,
              competition_lvl: result.competition_lvl,
              ai_analysis: result.ai_analysis,
              status: "active",
            });
            signals++;
          }
        } catch (err) {
          console.error(`Demand analysis error for item ${item.id}:`, err);
        }
      }

      console.log(`Demand Analysis: processed ${processed}, found ${signals} signals`);
      return { processed, signals };
    },
    { connection, concurrency: 1 }
  );

  // Schedule: every hour
  queue.upsertJobScheduler("demand-analysis-repeat", {
    every: 60 * 60 * 1000,
  }, {
    name: "ai-demand-analysis",
  });

  trackWorker(worker);
  return { queue, worker };
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `cd services/backend && npx vitest run tests/ai-demand-analysis.test.ts`
Expected: 5 tests PASS

- [ ] **Step 5: 提交**

```bash
git add services/backend/src/queues/ai-demand-analysis.ts services/backend/tests/ai-demand-analysis.test.ts
git commit -m "feat: add AI demand analysis worker using Sonnet model"
```

---

### Task 10: 完善队列注册 + 整合测试

**Files:**
- Modify: `services/backend/src/queues/registry.ts`
- Modify: `services/backend/src/index.ts`

- [ ] **Step 1: 完善队列注册器**

Replace `services/backend/src/queues/registry.ts` with:

```typescript
import type { AppConfig } from "../config.js";
import { setupHNCollector } from "./collect-hn.js";
import { setupPHCollector } from "./collect-ph.js";
import { setupRedditCollector } from "./collect-reddit.js";
import { setupRSSCollector } from "./collect-rss.js";
import { setupAITagSummarize } from "./ai-tag-summarize.js";
import { setupDemandAnalysis } from "./ai-demand-analysis.js";

const workers: Array<{ close: () => Promise<void> }> = [];
const queues: Array<{ close: () => Promise<void> }> = [];

export async function registerQueues(config: AppConfig): Promise<void> {
  const collectors = [
    setupHNCollector(config),
    setupPHCollector(config),
    setupRedditCollector(config),
    setupRSSCollector(config),
  ];

  const aiProcessors = [
    setupAITagSummarize(config),
    setupDemandAnalysis(config),
  ];

  for (const { queue, worker } of [...collectors, ...aiProcessors]) {
    queues.push(queue);
    workers.push(worker);
  }

  console.log(`Registered ${collectors.length} collectors + ${aiProcessors.length} AI processors`);
}

export async function closeQueues(): Promise<void> {
  await Promise.all(workers.map((w) => w.close()));
  await Promise.all(queues.map((q) => q.close()));
  workers.length = 0;
  queues.length = 0;
}

export function trackWorker(worker: { close: () => Promise<void> }): void {
  workers.push(worker);
}
```

- [ ] **Step 2: 运行所有后端测试**

Run: `cd services/backend && npx vitest run`
Expected: 所有测试通过 (config 3 + HN 3 + PH 4 + Reddit 4 + RSS 4 + AI Tag 5 + Demand 5 = 28 tests)

- [ ] **Step 3: 提交**

```bash
git add services/backend/src/queues/registry.ts
git commit -m "feat: wire all collectors and AI processors into queue registry"
```

---

### Task 11: Dockerfile + 部署配置

**Files:**
- Create: `services/backend/Dockerfile`
- Create: `services/backend/.env.example`
- Create: `docker-compose.yml` (project root)

- [ ] **Step 1: 创建 Dockerfile**

Create `services/backend/Dockerfile`:

```dockerfile
FROM node:22-slim AS base
RUN corepack enable

WORKDIR /app

# Copy workspace config
COPY pnpm-workspace.yaml pnpm-lock.yaml ./
COPY services/backend/package.json services/backend/

# Install dependencies
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    cd services/backend && pnpm install --frozen-lockfile --prod

# Copy source
COPY services/backend/src services/backend/src
COPY services/backend/tsconfig.json services/backend/

WORKDIR /app/services/backend

EXPOSE 3001

CMD ["node", "--import", "tsx", "src/index.ts"]
```

- [ ] **Step 2: 创建环境变量模板**

Create `services/backend/.env.example`:

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Redis
REDIS_URL=redis://localhost:6379

# Anthropic
ANTHROPIC_API_KEY=sk-ant-your-key

# Optional
PORT=3001
PH_API_TOKEN=your-producthunt-token
```

- [ ] **Step 3: 创建 docker-compose.yml**

Create `docker-compose.yml` in project root:

```yaml
version: "3.9"

services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    restart: unless-stopped

  backend:
    build:
      context: .
      dockerfile: services/backend/Dockerfile
    ports:
      - "3001:3001"
    env_file:
      - services/backend/.env
    depends_on:
      - redis
    restart: unless-stopped

volumes:
  redis-data:
```

- [ ] **Step 4: 提交**

```bash
git add services/backend/Dockerfile services/backend/.env.example docker-compose.yml
git commit -m "feat: add Dockerfile and docker-compose for backend deployment"
```

---

### Task 12: 端到端验证

**Files:**
- No new files

- [ ] **Step 1: 运行后端所有测试**

```bash
cd services/backend && npx vitest run
```

Expected: 所有 28 测试通过

- [ ] **Step 2: 运行前端所有测试**

```bash
cd /Users/lwx/Workspace/partime/lighthouse && npx vitest run
```

Expected: 所有 51 前端测试仍然通过

- [ ] **Step 3: 运行前端构建检查**

```bash
cd /Users/lwx/Workspace/partime/lighthouse && npx next build
```

Expected: 构建成功，前端路由不受后端服务影响

- [ ] **Step 4: TypeScript 类型检查后端**

```bash
cd services/backend && npx tsc --noEmit
```

Expected: 无类型错误

- [ ] **Step 5: 提交最终修复（如有）**

```bash
git add -A
git commit -m "fix: resolve build issues for backend services"
```
