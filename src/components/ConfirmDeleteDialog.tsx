import React, { useState } from 'react';
import { ChatItem } from '../types';
import { AlertTriangle, Download, Trash2, X } from 'lucide-react';
import { exportChatsToCSV, exportChatsToJSON, triggerFileDownload } from '../core/export';

interface ConfirmDeleteDialogProps {
  selectedChats: ChatItem[];
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (dryRun: boolean) => void;
  requireTextThreshold?: number;
}

export const ConfirmDeleteDialog: React.FC<ConfirmDeleteDialogProps> = ({
  selectedChats,
  isOpen,
  onClose,
  onConfirm,
  requireTextThreshold = 10,
}) => {
  const [confirmText, setConfirmText] = useState('');
  const [dryRun, setDryRun] = useState(false);

  if (!isOpen) return null;

  const count = selectedChats.length;
  const requiresTypeConfirmation = count >= requireTextThreshold;
  const isConfirmDisabled = requiresTypeConfirmation && confirmText.trim().toUpperCase() !== 'DELETE';

  const handleExportCSV = () => {
    const csv = exportChatsToCSV(selectedChats);
    triggerFileDownload(csv, `chatsweep-export-${Date.now()}.csv`, 'text/csv');
  };

  const handleExportJSON = () => {
    const json = exportChatsToJSON(selectedChats);
    triggerFileDownload(json, `chatsweep-export-${Date.now()}.json`, 'application/json');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-rose-600 font-bold text-lg">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>Confirm Bulk Deletion</span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 rounded-xl p-3 text-xs text-rose-800 dark:text-rose-200 leading-relaxed">
          <strong>Permanent Action:</strong> You are about to bulk-delete <strong>{count}</strong> conversations. Once deleted from provider servers, they cannot be recovered by ChatSweep.
        </div>

        <div>
          <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Conversations to be deleted ({count}):
          </div>
          <div className="max-h-36 overflow-y-auto bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-lg p-2 space-y-1">
            {selectedChats.slice(0, 10).map((chat) => (
              <div
                key={chat.id}
                className="text-xs text-slate-800 dark:text-slate-200 truncate bg-white dark:bg-slate-800 px-2 py-1 rounded"
              >
                [{chat.provider}] {chat.title}
              </div>
            ))}
            {count > 10 && (
              <div className="text-[11px] text-slate-500 text-center py-1">
                ...and {count - 10} more
              </div>
            )}
          </div>
        </div>

        {/* Pre-deletion Export Options */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={handleExportJSON}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export JSON</span>
          </button>
        </div>

        {/* Dry-run option */}
        <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={dryRun}
            onChange={(e) => setDryRun(e.target.checked)}
            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
          />
          <span><strong>Dry-Run Mode:</strong> Run validation without triggering actual deletion</span>
        </label>

        {/* "DELETE" text confirmation */}
        {requiresTypeConfirmation && (
          <div>
            <label className="block text-xs font-semibold text-rose-600 dark:text-rose-400 mb-1">
              Safety check: Type "DELETE" below to enable:
            </label>
            <input
              type="text"
              placeholder="Type DELETE"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-rose-300 dark:border-rose-900 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-rose-500 font-bold"
            />
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(dryRun)}
            disabled={isConfirmDisabled}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50 transition-colors shadow-sm"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Permanently Delete</span>
          </button>
        </div>
      </div>
    </div>
  );
};
