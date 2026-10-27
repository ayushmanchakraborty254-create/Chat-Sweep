// Test environment setup
import { vi } from 'vitest';

// In-memory chrome storage mock
const storageStore: Record<string, any> = {};

const chromeMock = {
  storage: {
    local: {
      get: vi.fn(async (keys: string | string[] | Record<string, any> | null) => {
        if (!keys) return { ...storageStore };
        if (typeof keys === 'string') {
          return { [keys]: storageStore[keys] };
        }
        if (Array.isArray(keys)) {
          const res: Record<string, any> = {};
          keys.forEach(k => { res[k] = storageStore[k]; });
          return res;
        }
        const res: Record<string, any> = {};
        for (const [k, defaultVal] of Object.entries(keys)) {
          res[k] = storageStore[k] !== undefined ? storageStore[k] : defaultVal;
        }
        return res;
      }),
      set: vi.fn(async (items: Record<string, any>) => {
        Object.assign(storageStore, items);
      }),
      remove: vi.fn(async (keys: string | string[]) => {
        const kArr = Array.isArray(keys) ? keys : [keys];
        kArr.forEach(k => delete storageStore[k]);
      }),
      clear: vi.fn(async () => {
        for (const k of Object.keys(storageStore)) {
          delete storageStore[k];
        }
      }),
    },
  },
  runtime: {
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    getURL: vi.fn((path: string) => `chrome-extension://mock-id/${path}`),
  },
  tabs: {
    query: vi.fn(async () => []),
    sendMessage: vi.fn(),
  },
};

(globalThis as any).chrome = chromeMock;

// Reset store between tests
beforeEach(() => {
  for (const k of Object.keys(storageStore)) {
    delete storageStore[k];
  }
  vi.clearAllMocks();
});
