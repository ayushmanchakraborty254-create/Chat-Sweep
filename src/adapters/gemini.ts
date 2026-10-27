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

export const GEMINI_SELECTORS = {
  chatItem: [
    'div[data-test-id*="conversation-list-item"]',
    'div.conversation-item',
    'a[href*="/app/"]',
    'div.recent-item',
    'li:has(a[href*="/app/"])',
  ],
  title: [
    'span.conversation-title',
    'div.conversation-title',
    'span[title]',
    'div[title]',
    'span.text-ellipsis',
  ],
  menuTrigger: [
    'button[data-test-id*="conversation-actions-menu"]',
    'button[aria-label*="Conversation actions" i]',
    'button[aria-label*="More options" i]',
    'button:has(mat-icon[data-mat-icon-name="more_vert"])',
    'button:has(svg)',
  ],
  menuPopup: [
    'div.mat-mdc-menu-panel',
    'div[role="menu"]',
    'div.cdk-overlay-pane div[role="menu"]',
  ],
  deleteMenuItem: [
    'button[data-test-id*="delete"]',
    'div[role="menuitem"]:has-text("Delete")',
    'button[role="menuitem"]:has-text("Delete")',
    'button:has(mat-icon[data-mat-icon-name="delete"])',
  ],
  confirmDialog: [
    'mat-dialog-container',
    'div[role="dialog"]',
    'div.cdk-overlay-pane div[role="dialog"]',
  ],
  confirmDeleteButton: [
    'button[data-test-id*="confirm"]',
    'mat-dialog-actions button:has-text("Delete")',
    'button:has-text("Delete")',
  ],
  scrollContainer: [
    'div[data-test-id="recent-conversations-list"]',
    'div.conversations-container',
    'mat-sidenav-content',
    'div.overflow-y-auto',
  ],
  userMenu: [
    'button[aria-label*="Google Account" i]',
    'a[aria-label*="Google Account" i]',
    'img[alt*="Google Account" i]',
  ],
};

export class GeminiAdapter implements PlatformAdapter {
  public readonly id: ProviderId = 'gemini';
  public readonly name = 'Google Gemini';
  public readonly matches = ['gemini.google.com'];
  public readonly isExperimental = true;

  public readonly capabilities: AdapterCapabilities = {
    bulkSelect: true,
    individualDelete: true,
    nativeBulkDelete: false,
    exportMetadata: true,
    guidedMode: false,
  };

  public readonly selectors = GEMINI_SELECTORS;

  public isLoggedIn(): boolean {
    const user = queryWithFallbacks(document, GEMINI_SELECTORS.userMenu);
    const chats = queryWithFallbacks(document, GEMINI_SELECTORS.scrollContainer);
    return !!(user || chats || document.querySelector('rich-textarea'));
  }

  public async getChatList(): Promise<ChatItem[]> {
    const elements = queryAllWithFallbacks<HTMLElement>(document, GEMINI_SELECTORS.chatItem);
    const chats: ChatItem[] = [];
    const seenIds = new Set<string>();

    for (const el of elements) {
      let href = el.getAttribute('href');
      if (!href) {
        const link = el.querySelector<HTMLAnchorElement>('a[href*="/app/"]');
        if (link) href = link.getAttribute('href');
      }

      let id = '';
      if (href) {
        const match = href.match(/\/app\/([a-zA-Z0-9_\-]+)/);
        if (match) id = match[1];
      }

      if (!id) {
        id = el.getAttribute('data-test-id') || el.id || '';
      }

      if (!id) {
        id = 'gemini_' + Math.abs(this.hashCode(el.textContent || ''));
      }

      if (seenIds.has(id)) continue;
      seenIds.add(id);

      let title = '';
      const titleEl = queryWithFallbacks(el, GEMINI_SELECTORS.title);
      if (titleEl) {
        title = (titleEl.textContent || titleEl.getAttribute('title') || '').trim();
      } else {
        title = (el.textContent || 'Untitled Chat').trim();
      }
      title = title.replace(/\s+/g, ' ');

      const isPinned = el.querySelector('[data-mat-icon-name="push_pin"]') !== null;

      chats.push({
        id,
        provider: 'gemini',
        title: title || 'Untitled Chat',
        url: href ? (href.startsWith('http') ? href : `https://gemini.google.com${href}`) : undefined,
        elementRef: el,
        isPinned,
      });
    }

    return chats;
  }

  public observeChatList(callback: () => void): () => void {
    const target = queryWithFallbacks(document, GEMINI_SELECTORS.scrollContainer) || document.body;
    const observer = new MutationObserver(() => callback());
    observer.observe(target, { childList: true, subtree: true });
    return () => observer.disconnect();
  }

  public async loadMoreChats(onProgress?: (count: number) => void): Promise<boolean> {
    const container = queryWithFallbacks<HTMLElement>(document, GEMINI_SELECTORS.scrollContainer);
    if (!container) return false;

    let previousCount = 0;
    for (let i = 0; i < 20; i++) {
      const chats = await this.getChatList();
      onProgress?.(chats.length);
      if (chats.length === previousCount && i > 2) break;
      previousCount = chats.length;
      container.scrollTop = container.scrollHeight;
      await sleep(700);
    }
    return true;
  }

  public async deleteChat(chat: ChatItem): Promise<DeleteResult> {
    const el = chat.elementRef || document.querySelector(`a[href*="${chat.id}"]`);
    if (!el) {
      return {
        chatId: chat.id,
        provider: 'gemini',
        title: chat.title,
        success: false,
        status: 'failed',
        error: 'Gemini conversation item not found in sidebar.',
        timestamp: Date.now(),
      };
    }

    try {
      el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      await sleep(150);

      let menuTrigger = queryWithFallbacks<HTMLElement>(el, GEMINI_SELECTORS.menuTrigger);
      if (!menuTrigger) {
        menuTrigger = queryWithFallbacks<HTMLElement>(el.parentElement || el, GEMINI_SELECTORS.menuTrigger);
      }

      if (!menuTrigger) {
        return {
          chatId: chat.id,
          provider: 'gemini',
          title: chat.title,
          success: false,
          status: 'failed',
          error: 'Could not find Gemini conversation actions button.',
          timestamp: Date.now(),
        };
      }

      await triggerHumanClick(menuTrigger);
      await sleep(300);

      const menu = await waitForElement<HTMLElement>(GEMINI_SELECTORS.menuPopup, document, 2500);
      if (!menu) {
        return {
          chatId: chat.id,
          provider: 'gemini',
          title: chat.title,
          success: false,
          status: 'failed',
          error: 'Gemini actions menu failed to open.',
          timestamp: Date.now(),
        };
      }

      let deleteItem = findElementWithText(menu, 'button, [role="menuitem"]', 'Delete');
      if (!deleteItem) {
        deleteItem = queryWithFallbacks<HTMLElement>(menu, GEMINI_SELECTORS.deleteMenuItem);
      }

      if (!deleteItem) {
        return {
          chatId: chat.id,
          provider: 'gemini',
          title: chat.title,
          success: false,
          status: 'failed',
          error: 'Could not find "Delete" in Gemini menu.',
          timestamp: Date.now(),
        };
      }

      await triggerHumanClick(deleteItem);
      await sleep(350);

      const dialog = await waitForElement<HTMLElement>(GEMINI_SELECTORS.confirmDialog, document, 3000);
      if (!dialog) {
        return {
          chatId: chat.id,
          provider: 'gemini',
          title: chat.title,
          success: false,
          status: 'unverified',
          error: 'Gemini delete confirmation dialog not shown.',
          timestamp: Date.now(),
        };
      }

      let confirmBtn = findElementWithText(dialog, 'button', 'Delete');
      if (!confirmBtn) {
        confirmBtn = queryWithFallbacks<HTMLElement>(dialog, GEMINI_SELECTORS.confirmDeleteButton);
      }

      if (!confirmBtn) {
        return {
          chatId: chat.id,
          provider: 'gemini',
          title: chat.title,
          success: false,
          status: 'failed',
          error: 'Could not find Gemini confirm Delete button.',
          timestamp: Date.now(),
        };
      }

      await triggerHumanClick(confirmBtn);
      const verified = await this.verifyDeletion(chat);

      return {
        chatId: chat.id,
        provider: 'gemini',
        title: chat.title,
        success: verified,
        status: verified ? 'deleted' : 'unverified',
        timestamp: Date.now(),
      };
    } catch (err: any) {
      return {
        chatId: chat.id,
        provider: 'gemini',
        title: chat.title,
        success: false,
        status: 'failed',
        error: err?.message || 'Error automating Gemini deletion.',
        timestamp: Date.now(),
      };
    }
  }

  public async verifyDeletion(chat: ChatItem): Promise<boolean> {
    await sleep(600);
    if (chat.elementRef && !document.body.contains(chat.elementRef)) return true;
    if (chat.id && !document.querySelector(`a[href*="${chat.id}"]`)) return true;
    return waitForElementToDisappear(`a[href*="${chat.id}"]`, 2000);
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
