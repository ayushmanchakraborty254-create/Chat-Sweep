import React, { useState } from 'react';
import { ChatItem } from '../types';
import { ExternalLink, Pin, Calendar } from 'lucide-react';

interface ConversationTableProps {
  conversations: ChatItem[];
  selectedIds: string[];
  onToggle: (id: string, isShift: boolean) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onInvert: () => void;
}

export const ConversationTable: React.FC<ConversationTableProps> = ({
  conversations,
  selectedIds,
  onToggle,
  onSelectAll,
  onDeselectAll,
  onInvert,
}) => {
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const selectedSet = new Set(selectedIds);

  const totalPages = Math.ceil(conversations.length / pageSize) || 1;
  const currentPageItems = conversations.slice((page - 1) * pageSize, page * pageSize);

  const allCurrentSelected =
    currentPageItems.length > 0 && currentPageItems.every((item) => selectedSet.has(item.id));

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
      {/* Table Action Bar */}
      <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2 text-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={allCurrentSelected ? onDeselectAll : onSelectAll}
            className="px-2.5 py-1 font-medium bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md hover:bg-slate-100 dark:hover:bg-slate-600"
          >
            {allCurrentSelected ? 'Deselect All' : 'Select All Page'}
          </button>
          <button
            onClick={onInvert}
            className="px-2.5 py-1 font-medium bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md hover:bg-slate-100 dark:hover:bg-slate-600"
          >
            Invert
          </button>
          <span className="text-slate-500 dark:text-slate-400">
            {selectedIds.length} of {conversations.length} selected
          </span>
        </div>

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-2 py-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded disabled:opacity-40"
            >
              Prev
            </button>
            <span className="text-slate-600 dark:text-slate-300">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-2 py-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold uppercase tracking-wider">
            <tr>
              <th className="p-3 w-10 text-center">
                <input
                  type="checkbox"
                  checked={allCurrentSelected}
                  onChange={allCurrentSelected ? onDeselectAll : onSelectAll}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
              </th>
              <th className="p-3">Conversation Title</th>
              <th className="p-3 w-28">Provider</th>
              <th className="p-3 w-36">Discovered / Date</th>
              <th className="p-3 w-20 text-center">Link</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {currentPageItems.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-500 dark:text-slate-400">
                  No conversations match the current criteria or scan results.
                </td>
              </tr>
            ) : (
              currentPageItems.map((chat) => {
                const isSelected = selectedSet.has(chat.id);
                return (
                  <tr
                    key={chat.id}
                    onClick={(e) => onToggle(chat.id, (e as any).shiftKey)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-emerald-50/70 dark:bg-emerald-950/20'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => onToggle(chat.id, (e.nativeEvent as MouseEvent).shiftKey)}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                    </td>
                    <td className="p-3 font-medium text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      {chat.isPinned && (
                        <Pin className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      )}
                      <span className="truncate max-w-md" title={chat.title}>
                        {chat.title}
                      </span>
                    </td>
                    <td className="p-3 capitalize font-semibold text-slate-600 dark:text-slate-400">
                      <span className="inline-block px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[11px]">
                        {chat.provider}
                      </span>
                    </td>
                    <td className="p-3 text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <Calendar className="w-3 h-3 shrink-0" />
                      <span>{chat.date || (chat.timestamp ? new Date(chat.timestamp).toLocaleDateString() : 'Recent')}</span>
                    </td>
                    <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                      {chat.url ? (
                        <a
                          href={chat.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center text-slate-400 hover:text-emerald-600 p-1 rounded"
                          title="Open original chat"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-700">-</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
