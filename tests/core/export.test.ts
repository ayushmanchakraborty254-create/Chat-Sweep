import { describe, it, expect } from 'vitest';
import { exportChatsToCSV, exportChatsToJSON } from '../../src/core/export';
import { ChatItem } from '../../src/types';

describe('Export Service', () => {
  const mockChats: ChatItem[] = [
    {
      id: 'chat-1',
      provider: 'claude',
      title: 'Hello "World" Chat',
      date: '2025-01-10',
      url: 'https://claude.ai/chat/chat-1',
      isPinned: false,
    },
    {
      id: 'chat-2',
      provider: 'chatgpt',
      title: 'Simple Prompt',
      date: '2025-02-15',
      url: 'https://chatgpt.com/c/chat-2',
      isPinned: true,
    },
  ];

  it('exports to formatted CSV with proper quote escaping', () => {
    const csv = exportChatsToCSV(mockChats);
    expect(csv).toContain('ID,Provider,Title,Date,URL,IsPinned');
    expect(csv).toContain('"chat-1","claude","Hello ""World"" Chat","2025-01-10","https://claude.ai/chat/chat-1",false');
    expect(csv).toContain('"chat-2","chatgpt","Simple Prompt","2025-02-15","https://chatgpt.com/c/chat-2",true');
  });

  it('exports to valid JSON', () => {
    const jsonStr = exportChatsToJSON(mockChats);
    const parsed = JSON.parse(jsonStr);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBe(2);
    expect(parsed[0].title).toBe('Hello "World" Chat');
    expect(parsed[1].isPinned).toBe(true);
  });
});
