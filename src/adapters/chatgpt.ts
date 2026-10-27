import {
  AdapterCapabilities,
  ChatItem,
  DeleteResult,
  PlatformAdapter,
  ProviderId,
} from '../types';
import {
  queryWithFallbacks,
  queryAllWithFallbacks,
  triggerHumanClick,
  waitForElement,
  waitForElementToDisappear,
  findElementWithText,
} from '../utils/dom';
import { sleep } from '../utils/delays';

export const CHATGPT_SELECTORS = {
  chatItem: [
    'a[href*="/c/"]',
    'li[data-testid*="history-item"]',
    'div[data-testid*="history-item"]',
    'nav li:has(a[href*="/c/"])',
  ],
  title: [
    'div.relative.grow.overflow-hidden',
    'div.truncate',
    'span.truncate',
    'div[title]',
    'a[href*="/c/"] div',
  ],
  menuTrigger: [
    'button[data-testid*="history-item-menu"]',
    'button[id*="radix-"]',
    'button[aria-haspopup="menu"]',
    'button:has(svg.lucide-more-horizontal)',
    'button:has(svg.lucide-ellipsis)',
    'button:has(svg path[d*="M6 10"])',
  ],
  menuPopup: [
    'div[role="menu"]',
    'div[data-radix-popper-content-wrapper]',
    'div.radix-dropdown-content',
    'div[data-state="open"][role="menu"]',
  ],
  deleteMenuItem: [
    'div[role="menuitem"]:has-text("Delete")',
    'button[role="menuitem"]:has-text("Delete")',
    'div[role="menuitem"].text-token-text-error',
    'div[role="menuitem"][data-testid*="delete"]',
  ],
  confirmDialog: [
    'div[role="dialog"]',
    'div[role="alertdialog"]',
    'div[data-testid="confirm-dialog"]',
  ],
  confirmDeleteButton: [
    'button.btn-danger',
    'button[data-testid="confirm-delete-button"]',
    'button.bg-red-600',
    'div[role="dialog"] button:has-text("Delete")',
  ],
  scrollContainer: [
    'nav[aria-label*="history" i]',
    'nav div.overflow-y-auto',
    'div[data-testid="history-list"]',
    'nav ol',
    'nav',
  ],
  userMenu: [
    'button[data-testid="profile-button"]',
    'button[data-testid="accounts-profile-button"]',
    'button[aria-label*="User" i]',
    'div[data-testid="user-menu"]',
  ],
};

export class ChatGPTAdapter implements PlatformAdapter {
  public readonly id: ProviderId = 'chatgpt';
  public readonly name = 'ChatGPT';
  public readonly matches = ['chatgpt.com', 'chat.openai.com'];
  public readonly isExperimental = false;

  public readonly capabilities: AdapterCapabilities = {
    bulkSelect: true,
    individualDelete: true,
    nativeBulkDelete: false,
    exportMetadata: true,
    guidedMode: false,
    supportsFastApi: true,
  };

  public readonly selectors = CHATGPT_SELECTORS;

  public isLoggedIn(): boolean {
    const userElement = queryWithFallbacks(document, CHATGPT_SELECTORS.userMenu);
    const nav = queryWithFallbacks(document, CHATGPT_SELECTORS.scrollContainer);
    return !!(userElement || nav || document.querySelector('textarea#prompt-textarea'));
  }

  public async getChatList(): Promise<ChatItem[]> {
    const chatElements = queryAllWithFallbacks<HTMLElement>(
      document,
      CHATGPT_SELECTORS.chatItem
    );

    const chats: ChatItem[] = [];
    const seenIds = new Set<string>();

    for (const el of chatElements) {
      let href = el.getAttribute('href');
      if (!href) {
        const linkChild = el.querySelector<HTMLAnchorElement>('a[href*="/c/"]');
        if (linkChild) href = linkChild.getAttribute('href');
      }

      let id = '';
      if (href) {
        const match = href.match(/\/c\/([a-zA-Z0-9\-]+)/);
        if (match) id = match[1];
      }

      if (!id) {
        id = el.getAttribute('data-testid') || el.getAttribute('id') || '';
      }

      if (!id) {
        const text = el.textContent || '';
        id = 'chatgpt_' + Math.abs(this.hashCode(text));
      }

      if (seenIds.has(id)) continue;
      seenIds.add(id);

      // Title extraction
      let title = '';
      const titleEl = queryWithFallbacks(el, CHATGPT_SELECTORS.title);
      if (titleEl) {
        title = (titleEl.textContent || titleEl.getAttribute('title') || '').trim();
      } else {
        title = (el.textContent || 'Untitled Chat').trim();
      }

      title = title.replace(/\s+/g, ' ');

      // Pinned check
      const isPinned =
        el.closest('[data-testid="pinned-chats"]') !== null ||
        el.querySelector('svg[data-icon="pin"], svg.lucide-pin') !== null;

      chats.push({
        id,
        provider: 'chatgpt',
        title: title || 'Untitled Chat',
        url: href ? (href.startsWith('http') ? href : `https://chatgpt.com${href}`) : undefined,
        elementRef: el,
        isPinned,
      });
    }

    return chats;
  }

  public observeChatList(callback: () => void): () => void {
    const target =
      queryWithFallbacks(document, CHATGPT_SELECTORS.scrollContainer) || document.body;
    const observer = new MutationObserver(() => {
      callback();
    });

    observer.observe(target, { childList: true, subtree: true });
    return () => observer.disconnect();
  }

  public async loadMoreChats(onProgress?: (count: number) => void): Promise<boolean> {
    const container = queryWithFallbacks<HTMLElement>(
      document,
      CHATGPT_SELECTORS.scrollContainer
    );
    if (!container) return false;

    let previousHeight = 0;
    let attemptsWithoutNewChats = 0;

    for (let i = 0; i < 30; i++) {
      const initialChats = (await this.getChatList()).length;
      onProgress?.(initialChats);

      container.scrollTop = container.scrollHeight;
      await sleep(650);

      const currentChats = (await this.getChatList()).length;
      const currentHeight = container.scrollHeight;

      if (currentChats === initialChats && currentHeight === previousHeight) {
        attemptsWithoutNewChats++;
        if (attemptsWithoutNewChats >= 3) {
          break;
        }
      } else {
        attemptsWithoutNewChats = 0;
      }

      previousHeight = currentHeight;
    }

    const finalCount = (await this.getChatList()).length;
    onProgress?.(finalCount);
    return true;
  }

  private cachedAuthToken: string | null = null;

  private async getChatGPTAuthToken(): Promise<string | null> {
    if (this.cachedAuthToken) return this.cachedAuthToken;
    try {
      const res = await fetch('/api/auth/session', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (data?.accessToken) {
          this.cachedAuthToken = data.accessToken;
          return data.accessToken;
        }
      }
    } catch {}
    return null;
  }

  private async deleteViaChatGPTApi(chatId: string): Promise<boolean> {
    try {
      const token = await this.getChatGPTAuthToken();
      if (!token) return false;

      const res = await fetch(`/backend-api/conversation/${chatId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ is_visible: false }),
      });

      if (res.ok || res.status === 200 || res.status === 204) {
        return true;
      }
    } catch {}
    return false;
  }

  public async deleteChat(chat: ChatItem): Promise<DeleteResult> {
    const el = chat.elementRef || document.querySelector(`a[href*="${chat.id}"]`);

    // 1. PRIMARY STRATEGY: High-speed API Deletion (Instant, server-side verified)
    if (chat.id && !chat.id.startsWith('chatgpt_')) {
      const apiSuccess = await this.deleteViaChatGPTApi(chat.id);
      if (apiSuccess) {
        if (el) {
          const row = el.closest('li, div.group') || el;
          row.remove();
        }
        return {
          chatId: chat.id,
          provider: 'chatgpt',
          title: chat.title,
          success: true,
          status: 'deleted',
          timestamp: Date.now(),
        };
      }
    }

    // 2. FALLBACK STRATEGY: High-speed DOM Automation
    if (!el) {
      return {
        chatId: chat.id,
        provider: 'chatgpt',
        title: chat.title,
        success: false,
        status: 'failed',
        error: 'ChatGPT chat element not found in sidebar DOM.',
        timestamp: Date.now(),
      };
    }

    try {
      // Step 1: Fast hover
      el.dispatchEvent(new MouseEvent('pointerenter', { bubbles: true }));
      el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      await sleep(15);

      // Step 2: Locate menu trigger button
      let menuTrigger = queryWithFallbacks<HTMLElement>(el, CHATGPT_SELECTORS.menuTrigger);
      if (!menuTrigger) {
        const parentContainer = el.closest('li, div.group');
        if (parentContainer) {
          menuTrigger = queryWithFallbacks<HTMLElement>(
            parentContainer,
            CHATGPT_SELECTORS.menuTrigger
          );
        }
      }

      if (!menuTrigger) {
        return {
          chatId: chat.id,
          provider: 'chatgpt',
          title: chat.title,
          success: false,
          status: 'failed',
          error: 'Could not find ChatGPT item menu trigger.',
          timestamp: Date.now(),
        };
      }

      await triggerHumanClick(menuTrigger);
      await sleep(25);

      // Step 3: Wait for popup menu
      const menu = await waitForElement<HTMLElement>(
        CHATGPT_SELECTORS.menuPopup,
        document,
        1000
      );
      if (!menu) {
        return {
          chatId: chat.id,
          provider: 'chatgpt',
          title: chat.title,
          success: false,
          status: 'failed',
          error: 'ChatGPT options dropdown failed to open.',
          timestamp: Date.now(),
        };
      }

      // Step 4: Click Delete in menu
      let deleteItem = findElementWithText(menu, '[role="menuitem"], button, div', 'Delete');
      if (!deleteItem) {
        deleteItem = queryWithFallbacks<HTMLElement>(menu, CHATGPT_SELECTORS.deleteMenuItem);
      }

      if (!deleteItem) {
        return {
          chatId: chat.id,
          provider: 'chatgpt',
          title: chat.title,
          success: false,
          status: 'failed',
          error: 'Could not find "Delete" menu item in ChatGPT dropdown.',
          timestamp: Date.now(),
        };
      }

      await triggerHumanClick(deleteItem);
      await sleep(25);

      // Step 5: Wait for confirm dialog
      const dialog = await waitForElement<HTMLElement>(
        CHATGPT_SELECTORS.confirmDialog,
        document,
        1000
      );
      if (!dialog) {
        return {
          chatId: chat.id,
          provider: 'chatgpt',
          title: chat.title,
          success: false,
          status: 'unverified',
          error: 'ChatGPT delete confirmation modal did not open.',
          timestamp: Date.now(),
        };
      }

      // Step 6: Click confirmation Delete button
      let confirmBtn = findElementWithText(dialog, 'button', 'Delete');
      if (!confirmBtn) {
        confirmBtn = queryWithFallbacks<HTMLElement>(
          dialog,
          CHATGPT_SELECTORS.confirmDeleteButton
        );
      }

      if (!confirmBtn) {
        return {
          chatId: chat.id,
          provider: 'chatgpt',
          title: chat.title,
          success: false,
          status: 'failed',
          error: 'Could not locate ChatGPT confirmation Delete button.',
          timestamp: Date.now(),
        };
      }

      await triggerHumanClick(confirmBtn);

      // Step 7: Fast verification
      const verified = await this.verifyDeletion(chat);
      if (verified && el) {
        const row = el.closest('li, div.group') || el;
        row.remove();
      }

      return {
        chatId: chat.id,
        provider: 'chatgpt',
        title: chat.title,
        success: verified,
        status: verified ? 'deleted' : 'unverified',
        timestamp: Date.now(),
      };
    } catch (err: any) {
      return {
        chatId: chat.id,
        provider: 'chatgpt',
        title: chat.title,
        success: false,
        status: 'failed',
        error: err?.message || 'Error occurred during ChatGPT deletion automation.',
        timestamp: Date.now(),
      };
    }
  }

  public async verifyDeletion(chat: ChatItem): Promise<boolean> {
    // 1. Immediate check: 0ms wait if element is already detached
    if (chat.elementRef && !document.body.contains(chat.elementRef)) {
      return true;
    }
    if (chat.id && !document.querySelector(`a[href*="${chat.id}"]`)) {
      return true;
    }
    // 2. Poll in ultra-short intervals (max 40ms)
    for (let i = 0; i < 2; i++) {
      await sleep(20);
      if (chat.elementRef && !document.body.contains(chat.elementRef)) {
        return true;
      }
      if (chat.id && !document.querySelector(`a[href*="${chat.id}"]`)) {
        return true;
      }
    }
    return false;
  }

  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }
}
