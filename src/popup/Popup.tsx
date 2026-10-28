import React, { useState, useEffect } from 'react';
import { registry } from '../core/registry';
import { Sparkles, Layers, RefreshCw, LayoutDashboard, Settings as SettingsIcon, ExternalLink, Power } from 'lucide-react';
import { PlatformAdapter } from '../types';
import { getSettings, saveSettings } from '../core/storage';

export const Popup: React.FC = () => {
  const [currentAdapter, setCurrentAdapter] = useState<PlatformAdapter | null>(null);
  const [currentTab, setCurrentTab] = useState<chrome.tabs.Tab | null>(null);
  const [detectedCount, setDetectedCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [extensionEnabled, setExtensionEnabled] = useState(true);

  useEffect(() => {
    loadSettings();
    detectCurrentPage();
  }, []);

  const loadSettings = async () => {
    try {
      const s = await getSettings();
      setExtensionEnabled(s.extensionEnabled !== false);
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleExtension = async () => {
    const nextState = !extensionEnabled;
    setExtensionEnabled(nextState);
    await saveSettings({ extensionEnabled: nextState });

    // Notify background service worker to update badge
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({
        type: 'SET_EXTENSION_ENABLED',
        enabled: nextState,
      }).catch(() => {});
    }

    // Broadcast change to all tabs immediately
    if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
      chrome.tabs.query({}, (tabs) => {
        for (const tab of tabs) {
          if (tab.id) {
            chrome.tabs.sendMessage(tab.id, {
              type: 'SET_EXTENSION_ENABLED',
              enabled: nextState,
            }).catch(() => {});
          }
        }
      });
    }
  };

  const detectCurrentPage = async () => {
    if (typeof chrome === 'undefined' || !chrome.tabs?.query) return;

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.url) return;
      setCurrentTab(tab);

      const urlObj = new URL(tab.url);
      const adapter = registry.getAdapterForHost(urlObj.hostname);
      setCurrentAdapter(adapter);

      if (adapter && tab.id) {
        // Query content script for page status
        try {
          const res = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_STATUS' });
          if (res?.conversationsDetected !== undefined) {
            setDetectedCount(res.conversationsDetected);
          }
        } catch {
          // Content script may not be loaded yet or restricted
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleBulk = async () => {
    if (!currentTab?.id) return;
    try {
      await chrome.tabs.sendMessage(currentTab.id, { type: 'TOGGLE_BULK_MODE' });
      window.close();
    } catch {
      alert('Please refresh the chat page once to enable the ChatSweep toolbar.');
    }
  };

  const handleScanPage = async () => {
    if (!currentTab?.id) return;
    setIsLoading(true);
    try {
      const res = await chrome.tabs.sendMessage(currentTab.id, { type: 'SCAN_CONVERSATIONS' });
      if (res?.count !== undefined) {
        setDetectedCount(res.count);
      }
    } catch {
      alert('Please refresh the page to allow scanning.');
    } finally {
      setIsLoading(false);
    }
  };

  const openDashboard = () => {
    if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
      chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
    }
  };

  const openOptions = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    }
  };

  return (
    <div className="w-[360px] bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-4 font-sans flex flex-col justify-between">
        {/* Header */}
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-sm">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-sm tracking-tight">ChatSweep</span>
                <span className="ml-1.5 text-[10px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-1 py-0.5 rounded">
                  v1.0
                </span>
              </div>
            </div>
            <button
              onClick={openOptions}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Options & Settings"
            >
              <SettingsIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Master ON/OFF Switch */}
          <div className={`my-3 p-3 rounded-xl border transition-all ${
            extensionEnabled 
              ? 'bg-emerald-50/70 dark:bg-emerald-950/25 border-emerald-200 dark:border-emerald-800/40 shadow-xs' 
              : 'bg-slate-100/80 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                  extensionEnabled ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                }`}>
                  <Power className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                    <span>ChatSweep Extension</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                      extensionEnabled ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                    }`}>
                      {extensionEnabled ? 'ON' : 'OFF'}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">
                    {extensionEnabled ? 'Active (buttons & toolbar visible)' : 'Turned off (hidden on all pages)'}
                  </div>
                </div>
              </div>

              {/* iOS style toggle switch */}
              <button
                type="button"
                role="switch"
                aria-checked={extensionEnabled}
                onClick={handleToggleExtension}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  extensionEnabled ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-600'
                }`}
                title={extensionEnabled ? 'Turn OFF extension' : 'Turn ON extension'}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    extensionEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Current Tab Status */}
          <div className="my-3">
            {!extensionEnabled ? (
              <div className="bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-4 text-center space-y-3">
                <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center mx-auto text-slate-500">
                  <Power className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    ChatSweep is Turned OFF
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    All floating buttons and checkboxes are hidden from chat pages. Click below to turn back ON.
                  </p>
                </div>
                <button
                  onClick={handleToggleExtension}
                  className="w-full inline-flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors cursor-pointer"
                >
                  <Power className="w-3.5 h-3.5" />
                  <span>Turn Extension ON</span>
                </button>
                <div className="text-[10px] text-slate-400">
                  💡 Tip: Press <kbd className="px-1 py-0.5 bg-slate-200 dark:bg-slate-700 rounded font-mono">Alt+C</kbd> on any chat page to toggle ON/OFF
                </div>
              </div>
            ) : currentAdapter ? (
            <div className="bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-emerald-800 dark:text-emerald-300 font-medium">
                    Current Platform
                  </div>
                  <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span>{currentAdapter.name}</span>
                    <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.2 rounded-full">
                      Ready
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-slate-500">Chats in View</div>
                  <div className="font-bold text-sm text-slate-800 dark:text-slate-200">
                    {detectedCount !== null ? detectedCount : 'Ready to scan'}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-1">
                <button
                  onClick={handleToggleBulk}
                  className="w-full inline-flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Toggle Bulk Select in Page</span>
                </button>

                <button
                  onClick={handleScanPage}
                  disabled={isLoading}
                  className="w-full inline-flex items-center justify-center gap-2 py-1.5 px-3 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  <span>{isLoading ? 'Scanning sidebar...' : 'Scan Active Sidebar'}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 text-center space-y-2">
              <p className="text-xs text-slate-600 dark:text-slate-300">
                You are not on a supported AI chat page.
              </p>
              <div className="text-[11px] text-slate-400">
                Supported: Claude, ChatGPT, Gemini, Grok, Perplexity, DeepSeek, Copilot, Mistral, Poe.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <button
          onClick={openDashboard}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 transition-colors py-1"
        >
          <LayoutDashboard className="w-3.5 h-3.5" />
          <span>Open Full Dashboard</span>
          <ExternalLink className="w-3 h-3" />
        </button>
        <span className="text-[10px] text-slate-400">100% Local</span>
      </div>
    </div>
  );
};
