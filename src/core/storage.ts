import { ActivityLogEntry, ProviderId, Settings, ChatItem } from '../types';

export const DEFAULT_SETTINGS: Settings = {
  minDelayMs: 15,
  maxDelayMs: 35,
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
  extensionEnabled: true,
  theme: 'auto',
  language: 'en',
};

export interface UIPositions {
  triggerPos?: { x: number; y: number };
  actionBarPos?: { x: number; y: number };
  isCollapsed?: boolean;
  actionBarDock?: 'top' | 'bottom' | 'free';
}

const STORAGE_KEYS = {
  SETTINGS: 'chatsweep_settings',
  ACTIVITY_LOGS: 'chatsweep_activity_logs',
  CACHED_CHATS: 'chatsweep_cached_chats',
  UI_POSITIONS: 'chatsweep_ui_positions',
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

export async function getUIPositions(): Promise<UIPositions> {
  let fallback: UIPositions = {};
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.UI_POSITIONS);
    if (raw) fallback = JSON.parse(raw);
  } catch {}

  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return fallback;
  }

  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.UI_POSITIONS);
    return { ...fallback, ...(result[STORAGE_KEYS.UI_POSITIONS] || {}) };
  } catch {
    return fallback;
  }
}

export async function saveUIPositions(positions: Partial<UIPositions>): Promise<UIPositions> {
  const current = await getUIPositions();
  const updated = { ...current, ...positions };
  try {
    localStorage.setItem(STORAGE_KEYS.UI_POSITIONS, JSON.stringify(updated));
  } catch {}
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    try {
      await chrome.storage.local.set({ [STORAGE_KEYS.UI_POSITIONS]: updated });
    } catch {}
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
