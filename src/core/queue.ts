import {
  ChatItem,
  DeleteResult,
  PlatformAdapter,
  QueueEngineState,
  QueueProgress,
  Settings,
} from '../types';
import { getHumanDelay, getExponentialBackoff, sleep } from '../utils/delays';
import { detectSecurityChallengeOrLogout, verifyElementTitleMatch } from '../utils/matching';
import { addActivityLog } from './storage';

export interface QueueCallbacks {
  onProgress?: (progress: QueueProgress) => void;
  onItemComplete?: (result: DeleteResult) => void;
  onComplete?: (progress: QueueProgress) => void;
}

export class DeletionQueue {
  private state: QueueEngineState = 'IDLE';
  private items: ChatItem[] = [];
  private adapter: PlatformAdapter;
  private settings: Settings;
  private callbacks: QueueCallbacks;

  private isCancelled = false;
  private isPaused = false;
  private currentIndex = 0;
  private results: DeleteResult[] = [];

  constructor(
    adapter: PlatformAdapter,
    settings: Settings,
    callbacks: QueueCallbacks = {}
  ) {
    this.adapter = adapter;
    this.settings = settings;
    this.callbacks = callbacks;
  }

  public getState(): QueueEngineState {
    return this.state;
  }

  public getProgress(): QueueProgress {
    const successCount = this.results.filter((r) => r.status === 'deleted').length;
    const failedCount = this.results.filter((r) => r.status === 'failed').length;
    const skippedCount = this.results.filter((r) => r.status === 'skipped').length;
    const unverifiedCount = this.results.filter((r) => r.status === 'unverified').length;

    return {
      state: this.state,
      currentIndex: this.currentIndex,
      total: this.items.length,
      processedCount: this.results.length,
      successCount,
      failedCount,
      skippedCount,
      unverifiedCount,
      currentTitle: this.items[this.currentIndex]?.title,
      currentProvider: this.adapter.id,
      results: [...this.results],
    };
  }

  public pause(): void {
    if (this.state === 'RUNNING') {
      this.isPaused = true;
      this.state = 'PAUSED';
      this.notifyProgress();
    }
  }

  public resume(): void {
    if (this.state === 'PAUSED') {
      this.isPaused = false;
      this.state = 'RUNNING';
      this.notifyProgress();
    }
  }

  public cancel(): void {
    this.isCancelled = true;
    this.isPaused = false;
    this.state = 'CANCELLED';
    this.notifyProgress();
  }

  public async start(items: ChatItem[]): Promise<QueueProgress> {
    if (this.state === 'RUNNING') {
      throw new Error('A deletion task is already actively running.');
    }

    this.items = [...items];
    this.currentIndex = 0;
    this.results = [];
    this.isCancelled = false;
    this.isPaused = false;

    // 1. VALIDATING
    this.state = 'VALIDATING';
    this.notifyProgress();

    // Check login state
    if (!this.adapter.isLoggedIn()) {
      this.state = 'FAILED';
      const progress = this.getProgress();
      this.callbacks.onComplete?.(progress);
      return progress;
    }

    // Check CAPTCHA / Security challenge
    const securityCheck = detectSecurityChallengeOrLogout();
    if (securityCheck.isBlocked) {
      this.state = 'FAILED';
      const progress = this.getProgress();
      this.callbacks.onComplete?.(progress);
      return progress;
    }

    // 2. RUNNING
    this.state = 'RUNNING';
    this.notifyProgress();

    const concurrency = this.adapter.capabilities.supportsFastApi ? 3 : 1;

    if (concurrency > 1) {
      let nextIndex = 0;
      const worker = async () => {
        while (nextIndex < this.items.length && !this.isCancelled) {
          while (this.isPaused && !this.isCancelled) {
            await sleep(80);
          }
          if (this.isCancelled) break;

          const idx = nextIndex++;
          if (idx >= this.items.length) break;

          const chat = this.items[idx];
          this.currentIndex = idx;
          this.notifyProgress();

          const result = await this.processSingleChat(chat);
          this.results.push(result);
          this.callbacks.onItemComplete?.(result);

          // Non-blocking log to local storage
          addActivityLog({
            provider: chat.provider,
            chatId: chat.id,
            chatTitle: chat.title,
            operation: 'delete',
            status: result.status,
            error: result.error,
          }).catch(() => {});

          this.notifyProgress();

          if (this.settings.minDelayMs > 0 && !this.isCancelled) {
            await sleep(this.settings.minDelayMs);
          }
        }
      };

      const workers = Array.from({ length: concurrency }, () => worker());
      await Promise.all(workers);
    } else {
      while (this.currentIndex < this.items.length) {
        // Check for cancellation
        if (this.isCancelled) {
          this.state = 'CANCELLED';
          break;
        }

        // Check for pause loop
        while (this.isPaused && !this.isCancelled) {
          await sleep(100);
        }
        if (this.isCancelled) {
          this.state = 'CANCELLED';
          break;
        }

        const chat = this.items[this.currentIndex];
        const result = await this.processSingleChat(chat);

        this.results.push(result);
        this.callbacks.onItemComplete?.(result);

        // Non-blocking log to local storage
        addActivityLog({
          provider: chat.provider,
          chatId: chat.id,
          chatTitle: chat.title,
          operation: 'delete',
          status: result.status,
          error: result.error,
        }).catch(() => {});

        this.currentIndex++;
        this.notifyProgress();

        // If more items remain, apply human delay
        if (this.currentIndex < this.items.length && !this.isCancelled) {
          const delay = getHumanDelay(this.settings.minDelayMs, this.settings.maxDelayMs);
          if (delay > 0) {
            await sleep(delay);
          }
        }
      }
    }

    // 3. Final state transition
    if (this.isCancelled) {
      this.state = 'CANCELLED';
    } else {
      const hasFailures = this.results.some((r) => r.status === 'failed');
      const hasSuccess = this.results.some((r) => r.status === 'deleted');

      if (hasFailures && hasSuccess) {
        this.state = 'PARTIAL_FAILURE';
      } else if (hasFailures && !hasSuccess) {
        this.state = 'FAILED';
      } else {
        this.state = 'COMPLETED';
      }
    }

    const finalProgress = this.getProgress();
    this.callbacks.onComplete?.(finalProgress);
    return finalProgress;
  }

  /**
   * Process a single chat deletion with retry logic and safety verification
   */
  private async processSingleChat(chat: ChatItem): Promise<DeleteResult> {
    // Check security challenge
    const challenge = detectSecurityChallengeOrLogout();
    if (challenge.isBlocked) {
      this.cancel();
      return {
        chatId: chat.id,
        provider: chat.provider,
        title: chat.title,
        success: false,
        status: 'failed',
        error: challenge.reason || 'Security challenge or CAPTCHA detected.',
        timestamp: Date.now(),
      };
    }

    // Dry Run Mode Check
    if (this.settings.dryRunMode) {
      await sleep(350);
      return {
        chatId: chat.id,
        provider: chat.provider,
        title: chat.title,
        success: true,
        status: 'deleted',
        error: '[Dry-run: simulation only, not deleted from server]',
        timestamp: Date.now(),
      };
    }

    // Verify title matching if elementRef is available
    if (chat.elementRef && !verifyElementTitleMatch(chat.elementRef, chat.title)) {
      return {
        chatId: chat.id,
        provider: chat.provider,
        title: chat.title,
        success: false,
        status: 'skipped',
        error: 'Target title mismatch: element content changed or re-ordered.',
        timestamp: Date.now(),
      };
    }

    // Execution with bounded retries & exponential backoff
    let attempts = 0;
    const maxRetries = Math.max(1, this.settings.maxRetries);

    while (attempts < maxRetries) {
      if (this.isCancelled) {
        return {
          chatId: chat.id,
          provider: chat.provider,
          title: chat.title,
          success: false,
          status: 'skipped',
          error: 'Cancelled by user.',
          timestamp: Date.now(),
        };
      }

      try {
        const deleteRes = await this.adapter.deleteChat(chat);
        if (deleteRes.success) {
          return deleteRes;
        }

        attempts++;
        if (attempts < maxRetries) {
          const backoff = getExponentialBackoff(attempts);
          await sleep(backoff);
        } else {
          return deleteRes;
        }
      } catch (err: any) {
        attempts++;
        if (attempts >= maxRetries) {
          return {
            chatId: chat.id,
            provider: chat.provider,
            title: chat.title,
            success: false,
            status: 'failed',
            error: err?.message || 'Unknown deletion error',
            timestamp: Date.now(),
          };
        }
        const backoff = getExponentialBackoff(attempts);
        await sleep(backoff);
      }
    }

    return {
      chatId: chat.id,
      provider: chat.provider,
      title: chat.title,
      success: false,
      status: 'failed',
      error: 'Max retries exceeded',
      timestamp: Date.now(),
    };
  }

  /**
   * Retry only the items that failed in the previous run
   */
  public async retryFailed(): Promise<QueueProgress> {
    const failedIds = new Set(
      this.results.filter((r) => r.status === 'failed').map((r) => r.chatId)
    );
    const failedItems = this.items.filter((item) => failedIds.has(item.id));
    if (failedItems.length === 0) {
      return this.getProgress();
    }
    return this.start(failedItems);
  }

  private notifyProgress(): void {
    this.callbacks.onProgress?.(this.getProgress());
  }
}
