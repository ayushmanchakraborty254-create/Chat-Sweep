/**
 * Delay utilities with humanized jitter and exponential backoff
 */

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Returns a randomized delay between minMs and maxMs with subtle jitter
 */
export function getHumanDelay(minMs = 600, maxMs = 1400): number {
  const min = Math.min(minMs, maxMs);
  const max = Math.max(minMs, maxMs);
  const base = Math.floor(Math.random() * (max - min + 1)) + min;
  // Add ±10% human micro-jitter
  const jitter = (Math.random() - 0.5) * 0.2 * base;
  return Math.max(200, Math.round(base + jitter));
}

/**
 * Calculates exponential backoff delay with jitter
 */
export function getExponentialBackoff(attempt: number, baseMs = 1500, maxMs = 10000): number {
  const delay = Math.min(maxMs, baseMs * Math.pow(2, attempt));
  const jitter = delay * 0.2 * Math.random();
  return Math.round(delay + jitter);
}
