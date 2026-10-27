import React from 'react';
import { ActivityLogEntry } from '../types';
import { StatusBadge } from './StatusBadge';
import { Trash2, ShieldCheck } from 'lucide-react';

interface ActivityLogTableProps {
  logs: ActivityLogEntry[];
  onClearLogs: () => void;
}

export const ActivityLogTable: React.FC<ActivityLogTableProps> = ({ logs, onClearLogs }) => {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
      <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span className="font-semibold text-xs text-slate-800 dark:text-slate-100">
            Local Operational Activity Log ({logs.length} entries)
          </span>
        </div>
        {logs.length > 0 && (
          <button
            onClick={onClearLogs}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-rose-600 hover:text-rose-700 dark:text-rose-400 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Logs</span>
          </button>
        )}
      </div>

      <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 text-[11px] text-slate-600 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 flex items-center gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
        <span>
          100% Local: This log is strictly an operational record stored in local browser storage. It does not contain chat contents, tokens, or credentials.
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold uppercase tracking-wider">
            <tr>
              <th className="p-3 w-32">Timestamp</th>
              <th className="p-3 w-28">Provider</th>
              <th className="p-3">Conversation Title</th>
              <th className="p-3 w-24">Operation</th>
              <th className="p-3 w-28">Status</th>
              <th className="p-3">Details / Reason</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-500 dark:text-slate-400">
                  No deletion operations recorded yet.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="p-3 text-slate-500 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleTimeString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </td>
                  <td className="p-3 capitalize font-semibold text-slate-700 dark:text-slate-300">
                    {log.provider}
                  </td>
                  <td className="p-3 font-medium text-slate-900 dark:text-slate-100 max-w-xs truncate" title={log.chatTitle}>
                    {log.chatTitle}
                  </td>
                  <td className="p-3 uppercase text-[10px] font-bold text-slate-500">
                    {log.operation}
                  </td>
                  <td className="p-3">
                    <StatusBadge status={log.status} />
                  </td>
                  <td className="p-3 text-slate-500 dark:text-slate-400 text-xs truncate max-w-sm" title={log.error || ''}>
                    {log.error ? <span className="text-rose-500">{log.error}</span> : <span className="text-emerald-600">Successfully verified</span>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
