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

export const PERPLEXITY_SELECTORS = {
  chatItem: [
    'a[href*="/search/"]',
    'div[data-testid*="thread-item"]',
    'div.thread-item',
    'li:has(a[href*="/search/"])',
  ],
  title: [
    'div.line-clamp-1',
    'div.truncate',
    'span.truncate',
    'div[title]',
  ],
  menuTrigger: [
    'button[aria-label*="Thread options" i]',
    'button[aria-label*="More options" i]',
    'button[data-testid*="menu-trigger"]',
    'button:has(svg.lucide-more-horizontal)',
    'button:has(svg)',
  ],
  menuPopup: [
    'div[role="menu"]',
    'div[data-radix-popper-content-wrapper]',
    'div[data-state="open"]',
  ],
  deleteMenuItem: [
    'div[role="menuitem"]:has-text("Delete")',
    'button[role="menuitem"]:has-text("Delete")',
    'button:has-text("Delete")',
  ],
  confirmDialog: [
    'div[role="alertdialog"]',
    'div[role="dialog"]',
  ],
  confirmDeleteButton: [
    'button:has-text("Delete")',
    'button.bg-red-500',
    'button[data-testid*="confirm"]',
  ],
  scrollContainer: [
    'div[data-testid="library-list"]',
    'nav',
    'div.overflow-y-auto',
  ],
  userMenu: [
    'button[aria-label*="User profile" i]',
    'button[data-testid="user-button"]',
    'img[alt*="avatar" i]',
  ],
};

export class PerplexityAdapter implements PlatformAdapter {
  public readonly id: ProviderId = 'perplexity';
  public readonly name = 'Perplexity';
  public readonly matches = ['perplexity.ai', 'www.perplexity.ai'];
  public readonly isExperimental = true;

  public readonly capabilities: AdapterCapabilities = {
    bulkSelect: true,
    individualDelete: true,
    nativeBulkDelete: false,
    exportMetadata: true,
    guidedMode: false,
  };

  public readonly selectors = PERPLEXITY_SELECTORS;

  public isLoggedIn(): boolean {
    return !!(
      queryWithFallbacks(document, PERPLEXITY_SELECTORS.userMenu) ||
      queryWithFallbacks(document, PERPLEXITY_SELECTORS.scrollContainer) ||
      document.querySelector('textarea[placeholder*="Ask anything"]')
    );
  }

  public async getChatList(): Promise<ChatItem[]> {
    const elements = queryAllWithFallbacks<HTMLElement>(document, PERPLEXITY_SELECTORS.chatItem);
    const chats: ChatItem[] = [];
    const seenIds = new Set<string>();

    for (const el of elements) {
      const href = el.getAttribute('href') || el.querySelector('a')?.getAttribute('href') || '';
      let id = '';
      if (href) {
        const m = href.match(/\/search\/([a-zA-Z0-9_\-]+)/);
        if (m) id = m[1];
      }
      if (!id) id = 'pplx_' + Math.abs(this.hashCode(el.textContent || ''));
      if (seenIds.has(id)) continue;
      seenIds.add(id);

      let title = '';
      const titleEl = queryWithFallbacks(el, PERPLEXITY_SELECTORS.title);
      title = (titleEl?.textContent || el.textContent || 'Untitled Thread').trim().replace(/\s+/g, ' ');

      chats.push({
        id,
        provider: 'perplexity',
        title,
        url: href ? (href.startsWith('http') ? href : `https://www.perplexity.ai${href}`) : undefined,
        elementRef: el,
      });
    }

    return chats;
  }

  public observeChatList(callback: () => void): () => void {
    const target = queryWithFallbacks(document, PERPLEXITY_SELECTORS.scrollContainer) || document.body;
    const observer = new MutationObserver(() => callback());
    observer.observe(target, { childList: true, subtree: true });
    return () => observer.disconnect();
  }

  public async loadMoreChats(onProgress?: (count: number) => void): Promise<boolean> {
    const container = queryWithFallbacks<HTMLElement>(document, PERPLEXITY_SELECTORS.scrollContainer);
    if (!container) return false;

    let prev = 0;
    for (let i = 0; i < 20; i++) {
      const chats = await this.getChatList();
      onProgress?.(chats.length);
      if (chats.length === prev && i > 2) break;
      prev = chats.length;
      container.scrollTop = container.scrollHeight;
      await sleep(650);
    }
    return true;
  }

  public async deleteChat(chat: ChatItem): Promise<DeleteResult> {
    const el = chat.elementRef || document.querySelector(`a[href*="${chat.id}"]`);
    if (!el) {
      return {
        chatId: chat.id,
        provider: 'perplexity',
        title: chat.title,
        success: false,
        status: 'failed',
        error: 'Perplexity thread item not found in DOM.',
        timestamp: Date.now(),
      };
    }

    try {
      el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      await sleep(15);

      const menuTrigger = queryWithFallbacks<HTMLElement>(el, PERPLEXITY_SELECTORS.menuTrigger);
      if (!menuTrigger) {
        return {
          chatId: chat.id,
          provider: 'perplexity',
          title: chat.title,
          success: false,
          status: 'failed',
          error: 'Could not find Perplexity thread menu button.',
          timestamp: Date.now(),
        };
      }

      await triggerHumanClick(menuTrigger);
      await sleep(25);

      const menu = await waitForElement<HTMLElement>(PERPLEXITY_SELECTORS.menuPopup, document, 1000);
      if (!menu) {
        return {
          chatId: chat.id,
          provider: 'perplexity',
          title: chat.title,
          success: false,
          status: 'failed',
          error: 'Perplexity menu failed to open.',
          timestamp: Date.now(),
        };
      }

      let deleteItem = findElementWithText(menu, '[role="menuitem"], button, div', 'Delete');
      if (!deleteItem) deleteItem = queryWithFallbacks<HTMLElement>(menu, PERPLEXITY_SELECTORS.deleteMenuItem);

      if (!deleteItem) {
        return {
          chatId: chat.id,
          provider: 'perplexity',
          title: chat.title,
          success: false,
          status: 'failed',
          error: 'Could not find "Delete" in Perplexity menu.',
          timestamp: Date.now(),
        };
      }

      await triggerHumanClick(deleteItem);
      await sleep(25);

      const dialog = await waitForElement<HTMLElement>(PERPLEXITY_SELECTORS.confirmDialog, document, 1000);
      if (!dialog) {
        return {
          chatId: chat.id,
          provider: 'perplexity',
          title: chat.title,
          success: false,
          status: 'unverified',
          error: 'Perplexity confirmation modal did not open.',
          timestamp: Date.now(),
        };
      }

      let confirmBtn = findElementWithText(dialog, 'button', 'Delete');
      if (!confirmBtn) confirmBtn = queryWithFallbacks<HTMLElement>(dialog, PERPLEXITY_SELECTORS.confirmDeleteButton);

      if (!confirmBtn) {
        return {
          chatId: chat.id,
          provider: 'perplexity',
          title: chat.title,
          success: false,
          status: 'failed',
          error: 'Could not locate Perplexity confirmation Delete button.',
          timestamp: Date.now(),
        };
      }

      await triggerHumanClick(confirmBtn);
      const verified = await this.verifyDeletion(chat);
      if (verified && el) {
        (el.closest('li, div.group') || el).remove();
      }

      return {
        chatId: chat.id,
        provider: 'perplexity',
        title: chat.title,
        success: verified,
        status: verified ? 'deleted' : 'unverified',
        timestamp: Date.now(),
      };
    } catch (err: any) {
      return {
        chatId: chat.id,
        provider: 'perplexity',
        title: chat.title,
        success: false,
        status: 'failed',
        error: err?.message || 'Error automating Perplexity thread deletion.',
        timestamp: Date.now(),
      };
    }
  }

  public async verifyDeletion(chat: ChatItem): Promise<boolean> {
    // 1. Immediate check: 0ms wait
    if (chat.elementRef && !document.body.contains(chat.elementRef)) return true;
    if (chat.id && !document.querySelector(`a[href*="${chat.id}"]`)) return true;
    // 2. Poll in ultra-short intervals (max 40ms)
    for (let i = 0; i < 2; i++) {
      await sleep(20);
      if (chat.elementRef && !document.body.contains(chat.elementRef)) return true;
      if (chat.id && !document.querySelector(`a[href*="${chat.id}"]`)) return true;
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
