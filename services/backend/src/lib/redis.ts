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
