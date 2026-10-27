import React, { useState, useEffect } from 'react';
import {
  ActivityLogEntry,
  ChatItem,
  FilterOptions,
  ProviderId,
  ProviderStatus,
  Settings,
} from '../types';
import { registry } from '../core/registry';
import {
  getActivityLogs,
  clearActivityLogs,
  getSettings,
  saveSettings,
  getDiscoveredChats,
} from '../core/storage';
import { filterChatList } from '../utils/date-filters';
import { ProviderCard } from '../components/ProviderCard';
import { ConversationTable } from '../components/ConversationTable';
import { FilterPanel } from '../components/FilterPanel';
import { ActivityLogTable } from '../components/ActivityLogTable';
import { ConfirmDeleteDialog } from '../components/ConfirmDeleteDialog';
import {
  Layers,
  History,
  Settings as SettingsIcon,
  Shield,
  Moon,
  Sun,
  Trash2,
  Sparkles,
  LayoutDashboard,
  ExternalLink,
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'manage' | 'activity' | 'settings' | 'about'>('overview');
  const [settings, setSettingsState] = useState<Settings | null>(null);
  const [providerStatuses, setProviderStatuses] = useState<ProviderStatus[]>([]);
  const [allChats, setAllChats] = useState<ChatItem[]>([]);
  const [selectedChatIds, setSelectedChatIds] = useState<string[]>([]);
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [isScanning, setIsScanning] = useState<Record<string, boolean>>({});
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  const [filters, setFilters] = useState<FilterOptions>({
    searchQuery: '',
    excludeQuery: '',
    dateRange: 'all',
    olderThanDays: 30,
    excludePinned: true,
    providerFilter: 'all',
  });

  // Load initial data
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    const loadedSettings = await getSettings();
    setSettingsState(loadedSettings);

    // Dark mode check
    const dark =
      loadedSettings.theme === 'dark' ||
      (loadedSettings.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    setIsDarkMode(dark);
    if (dark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Load cached chats from storage
    const cached = await getDiscoveredChats();
    const combinedChats: ChatItem[] = [];

    // Query active browser tabs to see which AI providers are currently open!
    let activeTabs: chrome.tabs.Tab[] = [];
    if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
      try {
        activeTabs = await chrome.tabs.query({});
      } catch {
        // Ignore
      }
    }

    const adapters = registry.getAllAdapters();
    const statuses: ProviderStatus[] = adapters.map((adapter) => {
      const isConnected = activeTabs.some((tab) => {
        if (!tab.url) return false;
        try {
          const urlObj = new URL(tab.url);
          return adapter.matches.some(
            (m) => urlObj.hostname === m || urlObj.hostname.endsWith('.' + m)
          );
        } catch {
          return false;
        }
      });

      const providerCache = cached[adapter.id];
      if (providerCache?.chats) {
        combinedChats.push(...providerCache.chats);
      }

      return {
        providerId: adapter.id,
        displayName: adapter.name,
        domain: adapter.matches[0],
        isSupported: true,
        isExperimental: adapter.isExperimental,
        isConnected,
        scanStatus: 'idle',
        conversationsDetected: providerCache?.chats ? providerCache.chats.length : 0,
        conversationsSelected: 0,
        lastScannedAt: providerCache?.timestamp,
        deletionCapability: 'ui_automation',
      };
    });

    setProviderStatuses(statuses);
    setAllChats(combinedChats);

    // Load logs
    const activityLogs = await getActivityLogs(150);
    setLogs(activityLogs);
  };

  const toggleDarkMode = () => {
    const next = !isDarkMode;
    setIsDarkMode(next);
    if (next) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    if (settings) {
      const updated = { ...settings, theme: next ? ('dark' as const) : ('light' as const) };
      setSettingsState(updated);
      saveSettings(updated);
    }
  };

  const handleScanProvider = async (providerId: string) => {
    setIsScanning((prev) => ({ ...prev, [providerId]: true }));
    try {
      // Find active tab matching this provider
      const adapter = registry.getAdapterById(providerId as ProviderId);
      if (!adapter) return;

      if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
        const tabs = await chrome.tabs.query({});
        const targetTab = tabs.find((t) => {
          if (!t.url) return false;
          try {
            const urlObj = new URL(t.url);
            return adapter.matches.some((m) => urlObj.hostname === m || urlObj.hostname.endsWith('.' + m));
          } catch {
            return false;
          }
        });

        if (targetTab && targetTab.id) {
          const res = await chrome.tabs.sendMessage(targetTab.id, { type: 'SCAN_CONVERSATIONS' });
          if (res?.chats) {
            await loadAllData();
          }
        } else {
          alert(`To scan ${adapter.name}, please open https://${adapter.matches[0]} in a browser tab first.`);
        }
      }
    } catch (err: any) {
      console.error('Scan error:', err);
    } finally {
      setIsScanning((prev) => ({ ...prev, [providerId]: false }));
    }
  };

  const handleManageProvider = (providerId: string) => {
    setFilters((prev) => ({ ...prev, providerFilter: providerId as ProviderId }));
    setActiveTab('manage');
  };

  // Selection Logic
  const filteredConversations = filterChatList(allChats, filters);

  const handleToggleSelect = (id: string, isShift: boolean) => {
    setSelectedChatIds((prev) => {
      const set = new Set(prev);
      if (set.has(id)) {
        set.delete(id);
      } else {
        set.add(id);
      }
      return Array.from(set);
    });
  };

  const handleSelectAllFiltered = () => {
    setSelectedChatIds(filteredConversations.map((c) => c.id));
  };

  const handleDeselectAll = () => {
    setSelectedChatIds([]);
  };

  const handleInvertSelection = () => {
    const currentSet = new Set(selectedChatIds);
    const inverted = filteredConversations
      .filter((c) => !currentSet.has(c.id))
      .map((c) => c.id);
    setSelectedChatIds(inverted);
  };

  const selectedChatsToProcess = allChats.filter((c) => selectedChatIds.includes(c.id));

  const handleClearLogs = async () => {
    if (confirm('Are you sure you want to clear your local activity audit logs?')) {
      await clearActivityLogs();
      setLogs([]);
    }
  };

  const handleSaveSettings = async (newSettings: Settings) => {
    const updated = await saveSettings(newSettings);
    setSettingsState(updated);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-base leading-tight flex items-center gap-2">
              <span>ChatSweep</span>
              <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-1.5 py-0.5 rounded">
                v1.0.0
              </span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Cross-Platform Bulk Chat History Manager
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-medium">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'overview'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Overview</span>
          </button>
          <button
            onClick={() => setActiveTab('manage')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'manage'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Manage Chats</span>
            {allChats.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 rounded-full text-[10px]">
                {allChats.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'activity'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Activity Log</span>
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'settings'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <SettingsIcon className="w-3.5 h-3.5" />
            <span>Settings</span>
          </button>
          <button
            onClick={() => setActiveTab('about')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'about'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Privacy & About</span>
          </button>
        </nav>

        {/* Right Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Toggle Light/Dark Theme"
          >
            {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Top Stat Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
                <div className="text-xs text-slate-500 dark:text-slate-400">Total Supported Providers</div>
                <div className="text-2xl font-bold mt-1 text-slate-900 dark:text-white">9 Platforms</div>
                <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-medium">
                  Claude, ChatGPT, Gemini, Grok, Perplexity, DeepSeek, Copilot, Mistral, Poe
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
                <div className="text-xs text-slate-500 dark:text-slate-400">Conversations Discovered</div>
                <div className="text-2xl font-bold mt-1 text-slate-900 dark:text-white">
                  {allChats.length}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">Available in local cache</div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
                <div className="text-xs text-slate-500 dark:text-slate-400">Conversations Selected</div>
                <div className="text-2xl font-bold mt-1 text-emerald-600">
                  {selectedChatIds.length}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">Ready for bulk actions</div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
                <div className="text-xs text-slate-500 dark:text-slate-400">Privacy & Security</div>
                <div className="text-2xl font-bold mt-1 text-slate-900 dark:text-white">100% Local</div>
                <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-medium">
                  Zero analytics, zero cloud transmission
                </div>
              </div>
            </div>

            {/* Providers Grid */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Supported AI Platforms
                </h2>
                <span className="text-xs text-slate-500">
                  Open an AI platform in a tab to scan and manage conversations
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {providerStatuses.map((status) => (
                  <ProviderCard
                    key={status.providerId}
                    status={status}
                    isScanning={isScanning[status.providerId] || false}
                    onScan={handleScanProvider}
                    onManage={handleManageProvider}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* MANAGE CHATS TAB */}
        {activeTab === 'manage' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Conversation History Manager
                </h2>
                <p className="text-xs text-slate-500">
                  Search, filter, select, and safely bulk delete conversation histories.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsDeleteDialogOpen(true)}
                  disabled={selectedChatIds.length === 0}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-40 transition-colors shadow-sm"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Selected ({selectedChatIds.length})</span>
                </button>
              </div>
            </div>

            {/* Filter Panel */}
            <FilterPanel
              filters={filters}
              onChange={setFilters}
              availableProviders={providerStatuses.map((p) => ({
                id: p.providerId,
                name: p.displayName,
              }))}
            />

            {/* Conversations Table */}
            <ConversationTable
              conversations={filteredConversations}
              selectedIds={selectedChatIds}
              onToggle={handleToggleSelect}
              onSelectAll={handleSelectAllFiltered}
              onDeselectAll={handleDeselectAll}
              onInvert={handleInvertSelection}
            />
          </div>
        )}

        {/* ACTIVITY LOG TAB */}
        {activeTab === 'activity' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Deletion Activity Audit Log
              </h2>
              <p className="text-xs text-slate-500">
                View chronological records of deletion operations, statuses, and retry outcomes.
              </p>
            </div>
            <ActivityLogTable logs={logs} onClearLogs={handleClearLogs} />
          </div>
        )}

        {/* SETTINGS TAB */}
        {activeTab === 'settings' && settings && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm max-w-2xl space-y-6">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Extension Preferences
            </h2>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold mb-1">Human-Like Delay Range (ms)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="200"
                    max="5000"
                    value={settings.minDelayMs}
                    onChange={(e) =>
                      handleSaveSettings({ ...settings, minDelayMs: parseInt(e.target.value, 10) })
                    }
                    className="w-24 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                  <span>to</span>
                  <input
                    type="number"
                    min="300"
                    max="10000"
                    value={settings.maxDelayMs}
                    onChange={(e) =>
                      handleSaveSettings({ ...settings, maxDelayMs: parseInt(e.target.value, 10) })
                    }
                    className="w-24 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                  <span className="text-slate-500">ms (randomized delay with jitter between deletions)</span>
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Maximum Retries per Chat</label>
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={settings.maxRetries}
                  onChange={(e) =>
                    handleSaveSettings({ ...settings, maxRetries: parseInt(e.target.value, 10) })
                  }
                  className="w-24 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
                <span className="ml-2 text-slate-500">retries with exponential backoff on errors</span>
              </div>

              <div>
                <label className="block font-semibold mb-1">Confirmation Strictness</label>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="requireTextConfirm"
                    checked={settings.requireDeleteConfirmationText}
                    onChange={(e) =>
                      handleSaveSettings({
                        ...settings,
                        requireDeleteConfirmationText: e.target.checked,
                      })
                    }
                    className="rounded text-emerald-600"
                  />
                  <label htmlFor="requireTextConfirm">
                    Require typing "DELETE" when deleting at least:
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={settings.confirmationTextThreshold}
                    onChange={(e) =>
                      handleSaveSettings({
                        ...settings,
                        confirmationTextThreshold: parseInt(e.target.value, 10),
                      })
                    }
                    className="w-16 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                  <span>chats</span>
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Default Exclusions</label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.excludePinnedByDefault}
                    onChange={(e) =>
                      handleSaveSettings({
                        ...settings,
                        excludePinnedByDefault: e.target.checked,
                      })
                    }
                    className="rounded text-emerald-600"
                  />
                  <span>Automatically exclude pinned and project chats from selections</span>
                </label>
              </div>

              <div>
                <label className="block font-semibold mb-1">Dry-Run Simulation Mode</label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.dryRunMode}
                    onChange={(e) =>
                      handleSaveSettings({
                        ...settings,
                        dryRunMode: e.target.checked,
                      })
                    }
                    className="rounded text-emerald-600"
                  />
                  <span>Enable dry-run mode (tests flow without executing actual deletion)</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* ABOUT & PRIVACY TAB */}
        {activeTab === 'about' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm max-w-3xl space-y-4">
            <div className="flex items-center gap-3">
              <Shield className="w-8 h-8 text-emerald-600" />
              <div>
                <h2 className="text-lg font-bold">Privacy & Architecture Manifesto</h2>
                <p className="text-xs text-slate-500">
                  Open-source, strictly client-side, zero analytics browser extension
                </p>
              </div>
            </div>

            <div className="prose dark:prose-invert text-xs space-y-3 leading-relaxed text-slate-700 dark:text-slate-300">
              <p>
                <strong>100% Local Execution:</strong> ChatSweep operates entirely inside your local browser. It does not send conversation titles, messages, authentication tokens, cookies, or account credentials to any remote server or third-party service.
              </p>
              <p>
                <strong>Safe UI Automation:</strong> Rather than exploiting reverse-engineered private endpoints that might break or trigger account alerts, ChatSweep drives the site’s own deletion UI directly using resilient DOM selectors and verification checks.
              </p>
              <p>
                <strong>Pre-Action Verification:</strong> Before deleting any conversation, ChatSweep verifies that the DOM element’s title matches the selected item to prevent off-by-one or list re-ordering mistakes.
              </p>
              <p>
                <strong>Adding New Platforms:</strong> The adapter system is modular. To add a new platform, simply implement the <code>PlatformAdapter</code> interface in <code>src/adapters/</code> and register it in <code>registry.ts</code>.
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Confirmation Dialog */}
      <ConfirmDeleteDialog
        isOpen={isDeleteDialogOpen}
        selectedChats={selectedChatsToProcess}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={(dryRun) => {
          setIsDeleteDialogOpen(false);
          alert(
            `Deletion initiated for ${selectedChatsToProcess.length} conversations (${dryRun ? 'Dry-run' : 'Live'}). For live browser UI execution, please use the floating ChatSweep button directly inside the AI platform tab.`
          );
        }}
      />
    </div>
  );
};
