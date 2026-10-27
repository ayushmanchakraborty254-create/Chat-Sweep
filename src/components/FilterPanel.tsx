import React from 'react';
import { FilterOptions, ProviderId } from '../types';
import { Search, Filter, RotateCcw } from 'lucide-react';

interface FilterPanelProps {
  filters: FilterOptions;
  onChange: (filters: FilterOptions) => void;
  availableProviders: { id: ProviderId; name: string }[];
}

export const FilterPanel: React.FC<FilterPanelProps> = ({
  filters,
  onChange,
  availableProviders,
}) => {
  const handleReset = () => {
    onChange({
      searchQuery: '',
      excludeQuery: '',
      dateRange: 'all',
      olderThanDays: 30,
      excludePinned: true,
      providerFilter: 'all',
    });
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm mb-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
          <Filter className="w-4 h-4 text-emerald-600" />
          <span>Filters & Selection Criteria</span>
        </div>
        <button
          onClick={handleReset}
          className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 flex items-center gap-1 transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reset</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {/* Search Input */}
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            Search Titles
          </label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="e.g. debugging, recipe..."
              value={filters.searchQuery}
              onChange={(e) => onChange({ ...filters, searchQuery: e.target.value })}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Exclude Keyword */}
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            Exclude Keyword
          </label>
          <input
            type="text"
            placeholder="e.g. important, project..."
            value={filters.excludeQuery}
            onChange={(e) => onChange({ ...filters, excludeQuery: e.target.value })}
            className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Date Range */}
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            Date Filter
          </label>
          <select
            value={filters.dateRange}
            onChange={(e) => onChange({ ...filters, dateRange: e.target.value as any })}
            className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">All Time</option>
            <option value="today">Today only</option>
            <option value="7days">Last 7 days</option>
            <option value="30days">Last 30 days</option>
            <option value="older_than_x">Older than X days...</option>
            <option value="custom">Custom Date Range...</option>
          </select>
        </div>

        {/* Provider Filter */}
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            AI Platform
          </label>
          <select
            value={filters.providerFilter || 'all'}
            onChange={(e) => onChange({ ...filters, providerFilter: e.target.value as any })}
            className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">All Providers</option>
            {availableProviders.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Conditional: Older than X days */}
      {filters.dateRange === 'older_than_x' && (
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
            Keep conversations from the last:
          </label>
          <input
            type="number"
            min="1"
            max="3650"
            value={filters.olderThanDays || 30}
            onChange={(e) => onChange({ ...filters, olderThanDays: parseInt(e.target.value, 10) || 30 })}
            className="w-20 px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
          />
          <span className="text-xs text-slate-500">days (older chats will be selected)</span>
        </div>
      )}

      {/* Conditional: Custom Date Range */}
      {filters.dateRange === 'custom' && (
        <div className="flex items-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">From:</span>
            <input
              type="date"
              value={filters.customStartDate || ''}
              onChange={(e) => onChange({ ...filters, customStartDate: e.target.value })}
              className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">To:</span>
            <input
              type="date"
              value={filters.customEndDate || ''}
              onChange={(e) => onChange({ ...filters, customEndDate: e.target.value })}
              className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
            />
          </div>
        </div>
      )}

      {/* Pinned Exclusion */}
      <div className="flex items-center gap-2 pt-1">
        <input
          type="checkbox"
          id="excludePinned"
          checked={filters.excludePinned}
          onChange={(e) => onChange({ ...filters, excludePinned: e.target.checked })}
          className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
        />
        <label htmlFor="excludePinned" className="text-xs text-slate-600 dark:text-slate-400 select-none cursor-pointer">
          Exclude pinned, starred, or project chats by default
        </label>
      </div>
    </div>
  );
};
