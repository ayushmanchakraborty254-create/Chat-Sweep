import React from 'react';
import { ProviderStatus } from '../types';
import { StatusBadge } from './StatusBadge';
import { ExternalLink, RefreshCw, Layers } from 'lucide-react';

interface ProviderCardProps {
  status: ProviderStatus;
  onScan: (providerId: string) => void;
  onManage: (providerId: string) => void;
  isScanning?: boolean;
}

export const ProviderCard: React.FC<ProviderCardProps> = ({
  status,
  onScan,
  onManage,
  isScanning = false,
}) => {
  const getProviderIconColor = (id: string) => {
    switch (id) {
      case 'claude':
        return 'text-amber-600 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/40';
      case 'chatgpt':
        return 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/40';
      case 'gemini':
        return 'text-blue-600 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/40';
      case 'grok':
        return 'text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700';
      case 'perplexity':
        return 'text-teal-600 bg-teal-50 dark:bg-teal-950/40 border-teal-200 dark:border-teal-800/40';
      case 'deepseek':
        return 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800/40';
      case 'copilot':
        return 'text-sky-600 bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800/40';
      case 'mistral':
        return 'text-orange-600 bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800/40';
      case 'poe':
        return 'text-purple-600 bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800/40';
      default:
        return 'text-slate-600 bg-slate-50 border-slate-200';
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
      <div>
        {/* Top Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg border ${getProviderIconColor(status.providerId)}`}>
              {status.displayName.charAt(0)}
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                {status.displayName}
                {status.isExperimental ? (
                  <StatusBadge status="experimental" text="Experimental" />
                ) : (
                  <StatusBadge status="verified" text="Verified" />
                )}
              </h3>
              <a
                href={`https://${status.domain}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 inline-flex items-center gap-1 transition-colors"
              >
                {status.domain}
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          <StatusBadge
            status={status.isConnected ? 'connected' : 'not_connected'}
            text={status.isConnected ? 'Active Tab' : 'Offline'}
          />
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-2 my-4 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Chats Detected</div>
            <div className="text-lg font-bold text-slate-900 dark:text-white">
              {status.conversationsDetected}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Last Scan</div>
            <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mt-1">
              {status.lastScannedAt ? new Date(status.lastScannedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Never'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-4">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>Method: <strong className="text-slate-700 dark:text-slate-200">UI Automation</strong></span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
        <button
          onClick={() => onScan(status.providerId)}
          disabled={isScanning}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
          <span>{isScanning ? 'Scanning...' : 'Scan Tab'}</span>
        </button>

        <button
          onClick={() => onManage(status.providerId)}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Manage</span>
        </button>
      </div>
    </div>
  );
};
