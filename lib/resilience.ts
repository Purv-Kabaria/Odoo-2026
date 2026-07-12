import { logger } from "@/lib/logger";

type CircuitState = {
  failures: number;
  openedUntil: number;
};

type ResilienceOptions = {
  name: string;
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
  failureThreshold?: number;
  circuitOpenMs?: number;
};

const circuits = new Map<string, CircuitState>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getCircuit(name: string): CircuitState {
  const state = circuits.get(name);
  if (state) return state;

  const next = { failures: 0, openedUntil: 0 };
  circuits.set(name, next);
  return next;
}

function isCircuitOpen(name: string): boolean {
  const state = getCircuit(name);
  return state.openedUntil > Date.now();
}

function recordSuccess(name: string) {
  circuits.set(name, { failures: 0, openedUntil: 0 });
}

function recordFailure(name: string, threshold: number, circuitOpenMs: number) {
  const state = getCircuit(name);
  const failures = state.failures + 1;
  circuits.set(name, {
    failures,
    openedUntil: failures >= threshold ? Date.now() + circuitOpenMs : 0,
  });
}

export async function resilientFetch(
  input: string | URL,
  init: RequestInit | undefined,
  options: ResilienceOptions,
): Promise<Response | null> {
  const {
    name,
    timeoutMs = 5000,
    retries = 1,
    retryDelayMs = 100,
    failureThreshold = 5,
    circuitOpenMs = 30000,
  } = options;

  if (isCircuitOpen(name)) {
    logger.warn("resilience.circuit_open", { dependency: name });
    return null;
  }

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(input, {
        ...init,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (response.status >= 500 && attempt < retries) {
        await sleep(retryDelayMs * 2 ** attempt + Math.floor(Math.random() * 25));
        continue;
      }

      recordSuccess(name);
      return response;
    } catch (error) {
      clearTimeout(timeout);

      if (attempt >= retries) {
        recordFailure(name, failureThreshold, circuitOpenMs);
        logger.warn("resilience.request_failed", {
          dependency: name,
          errorMessage: error instanceof Error ? error.message : "Unknown request error",
        });
        return null;
      }

      await sleep(retryDelayMs * 2 ** attempt + Math.floor(Math.random() * 25));
    }
  }

  return null;
}
