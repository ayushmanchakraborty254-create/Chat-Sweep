import React, { useState, useEffect } from 'react';
import { ProviderId, Settings } from '../types';
import { registry } from '../core/registry';
import { DEFAULT_SETTINGS, getSettings, saveSettings, clearActivityLogs } from '../core/storage';
import { Sparkles, Save, RotateCcw, Shield, Trash2, CheckCircle2, Power } from 'lucide-react';

export const Options: React.FC = () => {
  const [settings, setSettingsState] = useState<Settings>(DEFAULT_SETTINGS);
  const [isSaved, setIsSaved] = useState(false);
  const adapters = registry.getAllAdapters();

  useEffect(() => {
    getSettings().then((s) => setSettingsState(s));
  }, []);

  const handleSave = async () => {
    const updated = await saveSettings(settings);
    setSettingsState(updated);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const handleReset = async () => {
    if (confirm('Reset all settings to default values?')) {
      const updated = await saveSettings(DEFAULT_SETTINGS);
      setSettingsState(updated);
    }
  };

  const handleToggleProvider = (id: ProviderId) => {
    setSettingsState((prev) => ({
      ...prev,
      enabledProviders: {
        ...prev.enabledProviders,
        [id]: !prev.enabledProviders[id],
      },
    }));
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-md">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold">ChatSweep Settings & Options</h1>
              <p className="text-xs text-slate-500">
                Configure deletion timing, safety thresholds, and active platforms
              </p>
            </div>
          </div>
          {isSaved && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
              <CheckCircle2 className="w-4 h-4" />
              <span>Saved!</span>
            </div>
          )}
        </div>

        {/* Master Extension Switch */}
        <div className={`p-4 rounded-xl border transition-all ${
          settings.extensionEnabled !== false
            ? 'bg-emerald-50/70 dark:bg-emerald-950/25 border-emerald-200 dark:border-emerald-800/40 shadow-sm'
            : 'bg-slate-100/80 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                settings.extensionEnabled !== false ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-300 dark:bg-slate-700 text-slate-500'
              }`}>
                <Power className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <span>ChatSweep Master Switch</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    settings.extensionEnabled !== false ? 'bg-emerald-600 text-white' : 'bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}>
                    {settings.extensionEnabled !== false ? 'ENABLED' : 'DISABLED'}
                  </span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {settings.extensionEnabled !== false 
                    ? 'Extension is active. Floating toolbar and checkboxes appear on supported AI platforms.' 
                    : 'Extension is turned off. All in-page buttons, bulk mode, and checkboxes are completely disabled.'}
                </div>
              </div>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={settings.extensionEnabled !== false}
              onClick={() => {
                const nextState = settings.extensionEnabled === false ? true : false;
                setSettingsState({ ...settings, extensionEnabled: nextState });
                saveSettings({ extensionEnabled: nextState });
                if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
                  chrome.runtime.sendMessage({ type: 'SET_EXTENSION_ENABLED', enabled: nextState }).catch(() => {});
                }
              }}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                settings.extensionEnabled !== false ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-600'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  settings.extensionEnabled !== false ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Timing Section */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 shadow-sm">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">
            Timing & Automation Speed
          </h2>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-medium mb-1">Minimum Delay (ms)</label>
              <input
                type="number"
                min="200"
                max="5000"
                value={settings.minDelayMs}
                onChange={(e) =>
                  setSettingsState({ ...settings, minDelayMs: parseInt(e.target.value, 10) || 600 })
                }
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
              <span className="text-[11px] text-slate-500 mt-0.5 block">Recommended: 600ms</span>
            </div>

            <div>
              <label className="block font-medium mb-1">Maximum Delay (ms)</label>
              <input
                type="number"
                min="500"
                max="10000"
                value={settings.maxDelayMs}
                onChange={(e) =>
                  setSettingsState({ ...settings, maxDelayMs: parseInt(e.target.value, 10) || 1400 })
                }
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
              <span className="text-[11px] text-slate-500 mt-0.5 block">Recommended: 1400ms</span>
            </div>
          </div>

          <div className="text-xs">
            <label className="block font-medium mb-1">Retry Attempts on Failure</label>
            <input
              type="number"
              min="1"
              max="5"
              value={settings.maxRetries}
              onChange={(e) =>
                setSettingsState({ ...settings, maxRetries: parseInt(e.target.value, 10) || 3 })
              }
              className="w-24 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
            />
            <span className="ml-2 text-slate-500">retries with exponential backoff before marking as failed</span>
          </div>
        </div>

        {/* Safety Section */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 shadow-sm">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">
            Safety & Confirmation Checks
          </h2>

          <div className="space-y-3 text-xs">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.requireDeleteConfirmationText}
                onChange={(e) =>
                  setSettingsState({ ...settings, requireDeleteConfirmationText: e.target.checked })
                }
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span>Require typing "DELETE" when deleting large batches of conversations</span>
            </label>

            {settings.requireDeleteConfirmationText && (
              <div className="ml-6 flex items-center gap-2">
                <span>Trigger threshold:</span>
                <input
                  type="number"
                  min="2"
                  max="50"
                  value={settings.confirmationTextThreshold}
                  onChange={(e) =>
                    setSettingsState({
                      ...settings,
                      confirmationTextThreshold: parseInt(e.target.value, 10) || 10,
                    })
                  }
                  className="w-16 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
                <span className="text-slate-500">or more conversations</span>
              </div>
            )}

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.excludePinnedByDefault}
                onChange={(e) =>
                  setSettingsState({ ...settings, excludePinnedByDefault: e.target.checked })
                }
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span>Exclude pinned, starred, or project chats from bulk select by default</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.dryRunMode}
                onChange={(e) =>
                  setSettingsState({ ...settings, dryRunMode: e.target.checked })
                }
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-amber-600 dark:text-amber-400 font-semibold">
                Dry-Run Mode: Simulate all deletion flows without deleting actual conversations
              </span>
            </label>
          </div>
        </div>

        {/* Enabled Platforms Section */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 shadow-sm">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">
            Enabled AI Platforms
          </h2>
          <p className="text-xs text-slate-500">
            Enable or disable ChatSweep's in-page controls on individual platforms.
          </p>

          <div className="grid grid-cols-2 gap-2 text-xs">
            {adapters.map((adapter) => {
              const isEnabled = settings.enabledProviders[adapter.id] !== false;
              return (
                <label
                  key={adapter.id}
                  className="flex items-center justify-between p-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
                >
                  <span className="font-medium text-slate-900 dark:text-white">
                    {adapter.name}
                  </span>
                  <input
                    type="checkbox"
                    checked={isEnabled}
                    onChange={() => handleToggleProvider(adapter.id)}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                </label>
              );
            })}
          </div>
        </div>

        {/* Data & Audit Log Clear */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3 shadow-sm">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">
            Local Storage & Privacy
          </h2>
          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-500">
              Clear local operational activity logs and cached conversation lists.
            </div>
            <button
              onClick={async () => {
                if (confirm('Clear local activity logs?')) {
                  await clearActivityLogs();
                  alert('Operational logs cleared.');
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-600 hover:text-rose-700 border border-rose-200 dark:border-rose-900/40 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Logs</span>
            </button>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Defaults</span>
          </button>

          <button
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 px-6 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
};
