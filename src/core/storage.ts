import { ActivityLogEntry, ProviderId, Settings, ChatItem } from '../types';

export const DEFAULT_SETTINGS: Settings = {
  minDelayMs: 60,
  maxDelayMs: 140,
  maxRetries: 3,
  requireDeleteConfirmationText: true,
  confirmationTextThreshold: 10,
  dryRunMode: false,
  exportBeforeDelete: false,
  excludePinnedByDefault: true,
  enabledProviders: {
    claude: true,
    chatgpt: true,
    gemini: true,
    grok: true,
    perplexity: true,
    deepseek: true,
    copilot: true,
    mistral: true,
    poe: true,
  },
  theme: 'auto',
  language: 'en',
};

const STORAGE_KEYS = {
  SETTINGS: 'chatsweep_settings',
  ACTIVITY_LOGS: 'chatsweep_activity_logs',
  CACHED_CHATS: 'chatsweep_cached_chats',
};

export async function getSettings(): Promise<Settings> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return DEFAULT_SETTINGS;
  }
  const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
  return { ...DEFAULT_SETTINGS, ...(result[STORAGE_KEYS.SETTINGS] || {}) };
}

export async function saveSettings(settings: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const updated = { ...current, ...settings };
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: updated });
  }
  return updated;
}

export async function getActivityLogs(limit = 100): Promise<ActivityLogEntry[]> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return [];
  }
  const result = await chrome.storage.local.get(STORAGE_KEYS.ACTIVITY_LOGS);
  const logs: ActivityLogEntry[] = result[STORAGE_KEYS.ACTIVITY_LOGS] || [];
  return logs.slice(0, limit);
}

export async function addActivityLog(
  entry: Omit<ActivityLogEntry, 'id' | 'timestamp'>
): Promise<ActivityLogEntry> {
  const fullEntry: ActivityLogEntry = {
    ...entry,
    id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    timestamp: Date.now(),
  };

  const logs = await getActivityLogs(500);
  logs.unshift(fullEntry);

  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    await chrome.storage.local.set({ [STORAGE_KEYS.ACTIVITY_LOGS]: logs.slice(0, 200) });
  }

  return fullEntry;
}

export async function clearActivityLogs(): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    await chrome.storage.local.remove(STORAGE_KEYS.ACTIVITY_LOGS);
  }
}

export async function saveDiscoveredChats(
  provider: ProviderId,
  chats: Omit<ChatItem, 'elementRef'>[]
): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
  const result = await chrome.storage.local.get(STORAGE_KEYS.CACHED_CHATS);
  const existing = result[STORAGE_KEYS.CACHED_CHATS] || {};
  existing[provider] = {
    timestamp: Date.now(),
    chats: chats.map((c) => ({
      id: c.id,
      title: c.title,
      url: c.url,
      date: c.date,
      timestamp: c.timestamp,
      isPinned: c.isPinned,
      provider: c.provider,
    })),
  };
  await chrome.storage.local.set({ [STORAGE_KEYS.CACHED_CHATS]: existing });
}

export async function getDiscoveredChats(
  provider?: ProviderId
): Promise<Record<string, { timestamp: number; chats: ChatItem[] }>> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return {};
  const result = await chrome.storage.local.get(STORAGE_KEYS.CACHED_CHATS);
  const cached = result[STORAGE_KEYS.CACHED_CHATS] || {};
  if (provider) {
    return cached[provider] ? { [provider]: cached[provider] } : {};
  }
  return cached;
}
