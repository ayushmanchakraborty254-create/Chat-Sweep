import { describe, it, expect } from 'vitest';
import { filterChatList } from '../../src/utils/date-filters';
import { ChatItem, FilterOptions } from '../../src/types';

describe('filterChatList', () => {
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const now = Date.now();

  const mockChats: ChatItem[] = [
    {
      id: '1',
      provider: 'claude',
      title: 'React Performance Tuning',
      timestamp: now - 2 * 60 * 60 * 1000, // 2 hours ago
      isPinned: false,
    },
    {
      id: '2',
      provider: 'claude',
      title: 'PostgreSQL Database Optimization',
      timestamp: now - 3 * ONE_DAY_MS, // 3 days ago
      isPinned: false,
    },
    {
      id: '3',
      provider: 'chatgpt',
      title: 'Important Architecture Decision Record',
      timestamp: now - 45 * ONE_DAY_MS, // 45 days ago
      isPinned: true,
    },
    {
      id: '4',
      provider: 'chatgpt',
      title: 'TypeScript Generics Tutorial',
      timestamp: now - 60 * ONE_DAY_MS, // 60 days ago
      isPinned: false,
    },
  ];

  it('filters by search title keyword', () => {
    const filters: FilterOptions = {
      searchQuery: 'Database',
      excludeQuery: '',
      dateRange: 'all',
      excludePinned: false,
      providerFilter: 'all',
    };
    const res = filterChatList(mockChats, filters);
    expect(res.length).toBe(1);
    expect(res[0].id).toBe('2');
  });

  it('filters out excluded keyword', () => {
    const filters: FilterOptions = {
      searchQuery: '',
      excludeQuery: 'Architecture',
      dateRange: 'all',
      excludePinned: false,
      providerFilter: 'all',
    };
    const res = filterChatList(mockChats, filters);
    expect(res.find((c) => c.id === '3')).toBeUndefined();
    expect(res.length).toBe(3);
  });

  it('filters by today', () => {
    const filters: FilterOptions = {
      searchQuery: '',
      excludeQuery: '',
      dateRange: 'today',
      excludePinned: false,
      providerFilter: 'all',
    };
    const res = filterChatList(mockChats, filters);
    expect(res.length).toBe(1);
    expect(res[0].id).toBe('1');
  });

  it('filters by older than 30 days', () => {
    const filters: FilterOptions = {
      searchQuery: '',
      excludeQuery: '',
      dateRange: 'older_than_x',
      olderThanDays: 30,
      excludePinned: false,
      providerFilter: 'all',
    };
    const res = filterChatList(mockChats, filters);
    expect(res.length).toBe(2);
    expect(res.map((c) => c.id)).toEqual(['3', '4']);
  });

  it('excludes pinned items when requested', () => {
    const filters: FilterOptions = {
      searchQuery: '',
      excludeQuery: '',
      dateRange: 'all',
      excludePinned: true,
      providerFilter: 'all',
    };
    const res = filterChatList(mockChats, filters);
    expect(res.find((c) => c.isPinned)).toBeUndefined();
    expect(res.length).toBe(3);
  });

  it('filters by specific provider', () => {
    const filters: FilterOptions = {
      searchQuery: '',
      excludeQuery: '',
      dateRange: 'all',
      excludePinned: false,
      providerFilter: 'chatgpt',
    };
    const res = filterChatList(mockChats, filters);
    expect(res.length).toBe(2);
    expect(res.every((c) => c.provider === 'chatgpt')).toBe(true);
  });
});
