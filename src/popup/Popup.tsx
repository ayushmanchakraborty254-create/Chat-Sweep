import React, { useState, useEffect } from 'react';
import { registry } from '../core/registry';
import { Sparkles, Layers, RefreshCw, LayoutDashboard, Settings as SettingsIcon, ExternalLink } from 'lucide-react';
import { PlatformAdapter } from '../types';

export const Popup: React.FC = () => {
  const [currentAdapter, setCurrentAdapter] = useState<PlatformAdapter | null>(null);
  const [currentTab, setCurrentTab] = useState<chrome.tabs.Tab | null>(null);
  const [detectedCount, setDetectedCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    detectCurrentPage();
  }, []);

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

        {/* Current Tab Status */}
        <div className="my-4">
          {currentAdapter ? (
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
