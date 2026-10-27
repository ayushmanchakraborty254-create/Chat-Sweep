import { ChatItem, FilterOptions } from '../types';

/**
 * Filter chat items according to user criteria
 */
export function filterChatList(chats: ChatItem[], options: FilterOptions): ChatItem[] {
  const now = Date.now();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  return chats.filter((chat) => {
    // 1. Exclude pinned if requested
    if (options.excludePinned && chat.isPinned) {
      return false;
    }

    // 2. Provider filter
    if (options.providerFilter && options.providerFilter !== 'all') {
      if (chat.provider !== options.providerFilter) {
        return false;
      }
    }

    // 3. Search query (case-insensitive substring)
    if (options.searchQuery.trim()) {
      const q = options.searchQuery.trim().toLowerCase();
      if (!chat.title.toLowerCase().includes(q)) {
        return false;
      }
    }

    // 4. Exclude query
    if (options.excludeQuery.trim()) {
      const eq = options.excludeQuery.trim().toLowerCase();
      if (chat.title.toLowerCase().includes(eq)) {
        return false;
      }
    }

    // 5. Date filters (if timestamp or date is available)
    if (chat.timestamp || chat.date) {
      const itemTimestamp = chat.timestamp || parseRelativeDate(chat.date || '');
      if (itemTimestamp) {
        const ageMs = now - itemTimestamp;

        switch (options.dateRange) {
          case 'today':
            if (ageMs > ONE_DAY_MS) return false;
            break;
          case '7days':
            if (ageMs > 7 * ONE_DAY_MS) return false;
            break;
          case '30days':
            if (ageMs > 30 * ONE_DAY_MS) return false;
            break;
          case 'older_than_x':
            if (options.olderThanDays && options.olderThanDays > 0) {
              if (ageMs < options.olderThanDays * ONE_DAY_MS) return false;
            }
            break;
          case 'custom':
            if (options.customStartDate) {
              const start = new Date(options.customStartDate).getTime();
              if (itemTimestamp < start) return false;
            }
            if (options.customEndDate) {
              const end = new Date(options.customEndDate).getTime() + ONE_DAY_MS;
              if (itemTimestamp > end) return false;
            }
            break;
          case 'all':
          default:
            break;
        }
      }
    }

    return true;
  });
}

/**
 * Parses common date strings or relative strings like "Today", "Yesterday", "3 days ago"
 */
export function parseRelativeDate(dateStr: string): number | null {
  if (!dateStr) return null;
  const s = dateStr.trim().toLowerCase();
  const now = Date.now();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  if (s.includes('today') || s.includes('just now')) {
    return now;
  }
  if (s.includes('yesterday')) {
    return now - ONE_DAY_MS;
  }

  const daysAgoMatch = s.match(/(\d+)\s+day/);
  if (daysAgoMatch) {
    return now - parseInt(daysAgoMatch[1], 10) * ONE_DAY_MS;
  }

  const weeksAgoMatch = s.match(/(\d+)\s+week/);
  if (weeksAgoMatch) {
    return now - parseInt(weeksAgoMatch[1], 10) * 7 * ONE_DAY_MS;
  }

  const monthsAgoMatch = s.match(/(\d+)\s+month/);
  if (monthsAgoMatch) {
    return now - parseInt(monthsAgoMatch[1], 10) * 30 * ONE_DAY_MS;
  }

  const parsed = Date.parse(dateStr);
  return isNaN(parsed) ? null : parsed;
}
