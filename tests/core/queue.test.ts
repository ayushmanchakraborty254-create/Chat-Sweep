import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeletionQueue } from '../../src/core/queue';
import { ChatItem, PlatformAdapter, Settings } from '../../src/types';
import { DEFAULT_SETTINGS } from '../../src/core/storage';

describe('DeletionQueue', () => {
  let mockAdapter: PlatformAdapter;
  let testSettings: Settings;

  beforeEach(() => {
    testSettings = {
      ...DEFAULT_SETTINGS,
      minDelayMs: 10,
      maxDelayMs: 20,
      maxRetries: 2,
      dryRunMode: false,
    };

    mockAdapter = {
      id: 'claude',
      name: 'Claude',
      matches: ['claude.ai'],
      isExperimental: false,
      capabilities: {
        bulkSelect: true,
        individualDelete: true,
        nativeBulkDelete: false,
        exportMetadata: true,
        guidedMode: false,
      },
      selectors: {},
      isLoggedIn: vi.fn(() => true),
      getChatList: vi.fn(async () => []),
      observeChatList: vi.fn(() => () => {}),
      loadMoreChats: vi.fn(async () => true),
      deleteChat: vi.fn(async (chat) => ({
        chatId: chat.id,
        provider: 'claude' as const,
        title: chat.title,
        success: true,
        status: 'deleted' as const,
        timestamp: Date.now(),
      })),
      verifyDeletion: vi.fn(async () => true),
    };
  });

  it('runs queue through completion for selected chats', async () => {
    const items: ChatItem[] = [
      { id: '1', provider: 'claude', title: 'Chat 1' },
      { id: '2', provider: 'claude', title: 'Chat 2' },
    ];

    const onProgress = vi.fn();
    const queue = new DeletionQueue(mockAdapter, testSettings, { onProgress });

    const result = await queue.start(items);

    expect(result.state).toBe('COMPLETED');
    expect(result.successCount).toBe(2);
    expect(result.failedCount).toBe(0);
    expect(mockAdapter.deleteChat).toHaveBeenCalledTimes(2);
    expect(onProgress).toHaveBeenCalled();
  });

  it('handles dry-run mode without calling adapter deleteChat', async () => {
    const items: ChatItem[] = [
      { id: 'dry-1', provider: 'claude', title: 'Dry Run Chat' },
    ];

    const drySettings = { ...testSettings, dryRunMode: true };
    const queue = new DeletionQueue(mockAdapter, drySettings);

    const result = await queue.start(items);

    expect(result.state).toBe('COMPLETED');
    expect(result.successCount).toBe(1);
    expect(mockAdapter.deleteChat).not.toHaveBeenCalled();
  });

  it('retries transient failures up to maxRetries with backoff', async () => {
    const items: ChatItem[] = [
      { id: 'fail-then-pass', provider: 'claude', title: 'Retry Chat' },
    ];

    let callCount = 0;
    mockAdapter.deleteChat = vi.fn(async (chat) => {
      callCount++;
      if (callCount === 1) {
        return {
          chatId: chat.id,
          provider: 'claude',
          title: chat.title,
          success: false,
          status: 'failed',
          error: 'Temporary 500 error',
          timestamp: Date.now(),
        };
      }
      return {
        chatId: chat.id,
        provider: 'claude',
        title: chat.title,
        success: true,
        status: 'deleted',
        timestamp: Date.now(),
      };
    });

    const queue = new DeletionQueue(mockAdapter, testSettings);
    const result = await queue.start(items);

    expect(result.state).toBe('COMPLETED');
    expect(callCount).toBe(2);
    expect(result.successCount).toBe(1);
  });

  it('cancels queue mid-way when cancel() is invoked', async () => {
    const items: ChatItem[] = [
      { id: '1', provider: 'claude', title: 'Chat 1' },
      { id: '2', provider: 'claude', title: 'Chat 2' },
      { id: '3', provider: 'claude', title: 'Chat 3' },
    ];

    const queue = new DeletionQueue(mockAdapter, testSettings, {
      onItemComplete: () => {
        queue.cancel();
      },
    });

    const result = await queue.start(items);
    expect(result.state).toBe('CANCELLED');
    expect(result.processedCount).toBeLessThan(3);
  });

  it('aborts queue immediately if not logged in', async () => {
    mockAdapter.isLoggedIn = vi.fn(() => false);
    const queue = new DeletionQueue(mockAdapter, testSettings);
    const result = await queue.start([{ id: '1', provider: 'claude', title: 'Chat 1' }]);

    expect(result.state).toBe('FAILED');
    expect(mockAdapter.deleteChat).not.toHaveBeenCalled();
  });
});
