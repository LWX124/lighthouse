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
