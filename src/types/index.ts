export type ProviderId =
  | 'claude'
  | 'chatgpt'
  | 'gemini'
  | 'grok'
  | 'perplexity'
  | 'deepseek'
  | 'copilot'
  | 'mistral'
  | 'poe';

export type DeletionCapability =
  | 'ui_automation'
  | 'native_bulk'
  | 'guided'
  | 'unsupported';

export type DeletionStatus =
  | 'pending'
  | 'in_progress'
  | 'deleted'
  | 'failed'
  | 'skipped'
  | 'unverified';

export interface ChatItem {
  id: string;
  provider: ProviderId;
  title: string;
  url?: string;
  date?: string;
  timestamp?: number;
  elementRef?: HTMLElement | null;
  isPinned?: boolean;
  folder?: string;
  selected?: boolean;
}

export interface DeleteResult {
  chatId: string;
  provider: ProviderId;
  title: string;
  success: boolean;
  status: DeletionStatus;
  error?: string;
  timestamp: number;
}

export interface AdapterCapabilities {
  bulkSelect: boolean;
  individualDelete: boolean;
  nativeBulkDelete: boolean;
  exportMetadata: boolean;
  guidedMode: boolean;
  supportsFastApi?: boolean;
}

export interface PlatformAdapter {
  id: ProviderId;
  name: string;
  matches: string[];
  isExperimental: boolean;
  capabilities: AdapterCapabilities;
  selectors: Record<string, string | string[]>;
  isLoggedIn(): boolean;
  getChatList(): Promise<ChatItem[]>;
  observeChatList(callback: () => void): () => void;
  loadMoreChats(onProgress?: (count: number) => void): Promise<boolean>;
  deleteChat(chat: ChatItem): Promise<DeleteResult>;
  verifyDeletion(chat: ChatItem): Promise<boolean>;
}

export interface ProviderStatus {
  providerId: ProviderId;
  displayName: string;
  domain: string;
  isSupported: boolean;
  isExperimental: boolean;
  isConnected: boolean;
  scanStatus: 'idle' | 'scanning' | 'complete' | 'error';
  conversationsDetected: number;
  conversationsSelected: number;
  lastScannedAt?: number;
  errorMessage?: string;
  deletionCapability: DeletionCapability;
}

export type QueueEngineState =
  | 'IDLE'
  | 'VALIDATING'
  | 'AWAITING_CONFIRMATION'
  | 'RUNNING'
  | 'PAUSED'
  | 'VERIFYING'
  | 'COMPLETED'
  | 'PARTIAL_FAILURE'
  | 'FAILED'
  | 'CANCELLED';

export interface QueueProgress {
  state: QueueEngineState;
  currentIndex: number;
  total: number;
  processedCount: number;
  successCount: number;
  failedCount: number;
  skippedCount: number;
  unverifiedCount: number;
  currentTitle?: string;
  currentProvider?: ProviderId;
  results: DeleteResult[];
}

export interface Settings {
  minDelayMs: number;
  maxDelayMs: number;
  maxRetries: number;
  requireDeleteConfirmationText: boolean;
  confirmationTextThreshold: number;
  dryRunMode: boolean;
  exportBeforeDelete: boolean;
  excludePinnedByDefault: boolean;
  enabledProviders: Record<ProviderId, boolean>;
  extensionEnabled: boolean;
  theme: 'auto' | 'light' | 'dark';
  language: string;
}

export interface ActivityLogEntry {
  id: string;
  provider: ProviderId;
  chatId: string;
  chatTitle: string;
  timestamp: number;
  operation: 'delete' | 'scan' | 'export';
  status: DeletionStatus;
  error?: string;
}

export interface FilterOptions {
  searchQuery: string;
  excludeQuery: string;
  dateRange: 'all' | 'today' | '7days' | '30days' | 'older_than_x' | 'custom';
  olderThanDays?: number;
  customStartDate?: string;
  customEndDate?: string;
  excludePinned: boolean;
  providerFilter?: ProviderId | 'all';
}
