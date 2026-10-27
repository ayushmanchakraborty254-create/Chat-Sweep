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

export const POE_SELECTORS = {
  chatItem: [
    'div[class*="ChatHistoryItem"]:not([class*="title"]):not([class*="menu"])',
    'a[href*="/chat/"]',
    'div[class*="ChatList_item"]',
    'li:has(a[href*="/chat/"])',
  ],
  title: [
    'div[class*="ChatHistoryItem_title"]',
    'span.truncate',
    'div.truncate',
    'div[title]',
  ],
  menuTrigger: [
    'button[class*="ChatHistoryItem_menu"]',
    'button[aria-label*="More options" i]',
    'button:has(svg)',
  ],
  menuPopup: [
    'div[class*="Dropdown_menu"]',
    'div[role="menu"]',
    'div[data-radix-popper-content-wrapper]',
  ],
  deleteMenuItem: [
    'div[role="menuitem"]:has-text("Delete")',
    'button:has-text("Delete chat")',
    'button:has-text("Delete")',
  ],
  confirmDialog: [
    'div[class*="Modal"]',
    'div[role="dialog"]',
  ],
  confirmDeleteButton: [
    'button:has-text("Delete")',
    'button[class*="danger"]',
  ],
  scrollContainer: [
    'div[class*="ChatHistory_list"]',
    'nav',
    'div.overflow-y-auto',
  ],
  userMenu: [
    'button[class*="UserMenu"]',
    'a[href="/settings"]',
  ],
};

export class PoeAdapter implements PlatformAdapter {
  public readonly id: ProviderId = 'poe';
  public readonly name = 'Poe';
  public readonly matches = ['poe.com'];
  public readonly isExperimental = true;

  public readonly capabilities: AdapterCapabilities = {
    bulkSelect: true,
    individualDelete: true,
    nativeBulkDelete: false,
    exportMetadata: true,
    guidedMode: false,
  };

  public readonly selectors = POE_SELECTORS;

  public isLoggedIn(): boolean {
    return !!(
      queryWithFallbacks(document, POE_SELECTORS.userMenu) ||
      queryWithFallbacks(document, POE_SELECTORS.scrollContainer) ||
      document.querySelector('textarea[placeholder*="Talk to"]')
    );
  }

  public async getChatList(): Promise<ChatItem[]> {
    const elements = queryAllWithFallbacks<HTMLElement>(document, POE_SELECTORS.chatItem);
    const chats: ChatItem[] = [];
    const seenIds = new Set<string>();

    for (const el of elements) {
      const href = el.getAttribute('href') || el.querySelector('a')?.getAttribute('href') || '';
      let id = '';
      if (href) {
        const m = href.match(/\/chat\/([a-zA-Z0-9_\-]+)/);
        if (m) id = m[1];
      }
      if (!id) id = 'poe_' + Math.abs(this.hashCode(el.textContent || ''));
      if (seenIds.has(id)) continue;
      seenIds.add(id);

      const titleEl = queryWithFallbacks(el, POE_SELECTORS.title);
      const title = (titleEl?.textContent || el.textContent || 'Untitled Chat').trim().replace(/\s+/g, ' ');

      chats.push({
        id,
        provider: 'poe',
        title,
        url: href ? (href.startsWith('http') ? href : `https://poe.com${href}`) : undefined,
        elementRef: el,
      });
    }

    return chats;
  }

  public observeChatList(callback: () => void): () => void {
    const target = queryWithFallbacks(document, POE_SELECTORS.scrollContainer) || document.body;
    const observer = new MutationObserver(() => callback());
    observer.observe(target, { childList: true, subtree: true });
    return () => observer.disconnect();
  }

  public async loadMoreChats(onProgress?: (count: number) => void): Promise<boolean> {
    const container = queryWithFallbacks<HTMLElement>(document, POE_SELECTORS.scrollContainer);
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
        provider: 'poe',
        title: chat.title,
        success: false,
        status: 'failed',
        error: 'Poe chat item not found in DOM.',
        timestamp: Date.now(),
      };
    }

    try {
      el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      await sleep(40);

      const menuTrigger = queryWithFallbacks<HTMLElement>(el, POE_SELECTORS.menuTrigger);
      if (!menuTrigger) {
        return {
          chatId: chat.id,
          provider: 'poe',
          title: chat.title,
          success: false,
          status: 'failed',
          error: 'Could not find Poe item menu button.',
          timestamp: Date.now(),
        };
      }

      await triggerHumanClick(menuTrigger);
      await sleep(80);

      const menu = await waitForElement<HTMLElement>(POE_SELECTORS.menuPopup, document, 1500);
      if (!menu) {
        return {
          chatId: chat.id,
          provider: 'poe',
          title: chat.title,
          success: false,
          status: 'failed',
          error: 'Poe options menu failed to open.',
          timestamp: Date.now(),
        };
      }

      let deleteItem = findElementWithText(menu, '[role="menuitem"], button, div', 'Delete');
      if (!deleteItem) deleteItem = queryWithFallbacks<HTMLElement>(menu, POE_SELECTORS.deleteMenuItem);

      if (!deleteItem) {
        return {
          chatId: chat.id,
          provider: 'poe',
          title: chat.title,
          success: false,
          status: 'failed',
          error: 'Could not find "Delete" in Poe menu.',
          timestamp: Date.now(),
        };
      }

      await triggerHumanClick(deleteItem);
      await sleep(90);

      const dialog = await waitForElement<HTMLElement>(POE_SELECTORS.confirmDialog, document, 1500);
      if (!dialog) {
        return {
          chatId: chat.id,
          provider: 'poe',
          title: chat.title,
          success: false,
          status: 'unverified',
          error: 'Poe delete confirmation dialog did not appear.',
          timestamp: Date.now(),
        };
      }

      let confirmBtn = findElementWithText(dialog, 'button', 'Delete');
      if (!confirmBtn) confirmBtn = queryWithFallbacks<HTMLElement>(dialog, POE_SELECTORS.confirmDeleteButton);

      if (!confirmBtn) {
        return {
          chatId: chat.id,
          provider: 'poe',
          title: chat.title,
          success: false,
          status: 'failed',
          error: 'Could not find Poe confirmation Delete button.',
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
        provider: 'poe',
        title: chat.title,
        success: verified,
        status: verified ? 'deleted' : 'unverified',
        timestamp: Date.now(),
      };
    } catch (err: any) {
      return {
        chatId: chat.id,
        provider: 'poe',
        title: chat.title,
        success: false,
        status: 'failed',
        error: err?.message || 'Error automating Poe chat deletion.',
        timestamp: Date.now(),
      };
    }
  }

  public async verifyDeletion(chat: ChatItem): Promise<boolean> {
    // 1. Immediate check: 0ms wait
    if (chat.elementRef && !document.body.contains(chat.elementRef)) return true;
    if (chat.id && !document.querySelector(`a[href*="${chat.id}"]`)) return true;
    // 2. Poll in short intervals
    for (let i = 0; i < 6; i++) {
      await sleep(30);
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
