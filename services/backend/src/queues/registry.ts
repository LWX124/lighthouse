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
