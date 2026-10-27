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

export const COPILOT_SELECTORS = {
  chatItem: [
    'div[data-testid*="thread-item"]',
    'div.thread-item',
    'a[href*="/chats/"]',
    'div[role="listitem"]',
    'li:has(a[href*="/chats/"])',
  ],
  title: [
    'span.title',
    'div.truncate',
    'span.truncate',
    'div[title]',
  ],
  menuTrigger: [
    'button[aria-label*="More actions" i]',
    'button[aria-label*="More options" i]',
    'button[data-testid*="thread-menu"]',
    'button:has(svg)',
  ],
  menuPopup: [
    'div[role="menu"]',
    'div.fui-MenuPopover',
    'div.ms-ContextualMenu',
  ],
  deleteMenuItem: [
    'div[role="menuitem"]:has-text("Delete")',
    'button[role="menuitem"]:has-text("Delete")',
    'button:has-text("Delete")',
  ],
  confirmDialog: [
    'div[role="dialog"]',
    'div.fui-DialogSurface',
    'div.ms-Dialog-main',
  ],
  confirmDeleteButton: [
    'button:has-text("Delete")',
    'button[data-testid*="confirm"]',
    'button.fui-Button--danger',
  ],
  scrollContainer: [
    'div[data-testid="history-threads"]',
    'div.threads-container',
    'nav',
    'div.overflow-y-auto',
  ],
  userMenu: [
    'button[aria-label*="Account" i]',
    'div[data-testid*="user-profile"]',
    'img[alt*="profile" i]',
  ],
};

export class CopilotAdapter implements PlatformAdapter {
  public readonly id: ProviderId = 'copilot';
  public readonly name = 'Microsoft Copilot';
  public readonly matches = ['copilot.microsoft.com'];
  public readonly isExperimental = true;

  public readonly capabilities: AdapterCapabilities = {
    bulkSelect: true,
    individualDelete: true,
    nativeBulkDelete: false,
    exportMetadata: true,
    guidedMode: false,
  };

  public readonly selectors = COPILOT_SELECTORS;

  public isLoggedIn(): boolean {
    return !!(
      queryWithFallbacks(document, COPILOT_SELECTORS.userMenu) ||
      queryWithFallbacks(document, COPILOT_SELECTORS.scrollContainer) ||
      document.querySelector('textarea, div[contenteditable="true"]')
    );
  }

  public async getChatList(): Promise<ChatItem[]> {
    const elements = queryAllWithFallbacks<HTMLElement>(document, COPILOT_SELECTORS.chatItem);
    const chats: ChatItem[] = [];
    const seenIds = new Set<string>();

    for (const el of elements) {
      const href = el.getAttribute('href') || el.querySelector('a')?.getAttribute('href') || '';
      let id = '';
      if (href) {
        const m = href.match(/\/chats\/([a-zA-Z0-9_\-]+)/);
        if (m) id = m[1];
      }
      if (!id) id = 'copilot_' + Math.abs(this.hashCode(el.textContent || ''));
      if (seenIds.has(id)) continue;
      seenIds.add(id);

      const titleEl = queryWithFallbacks(el, COPILOT_SELECTORS.title);
      const title = (titleEl?.textContent || el.textContent || 'Untitled Chat').trim().replace(/\s+/g, ' ');

      chats.push({
        id,
        provider: 'copilot',
        title,
        url: href ? (href.startsWith('http') ? href : `https://copilot.microsoft.com${href}`) : undefined,
        elementRef: el,
      });
    }

    return chats;
  }

  public observeChatList(callback: () => void): () => void {
    const target = queryWithFallbacks(document, COPILOT_SELECTORS.scrollContainer) || document.body;
    const observer = new MutationObserver(() => callback());
    observer.observe(target, { childList: true, subtree: true });
    return () => observer.disconnect();
  }

  public async loadMoreChats(onProgress?: (count: number) => void): Promise<boolean> {
    const container = queryWithFallbacks<HTMLElement>(document, COPILOT_SELECTORS.scrollContainer);
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
        provider: 'copilot',
        title: chat.title,
        success: false,
        status: 'failed',
        error: 'Copilot chat item not found in DOM.',
        timestamp: Date.now(),
      };
    }

    try {
      el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      await sleep(40);

      const menuTrigger = queryWithFallbacks<HTMLElement>(el, COPILOT_SELECTORS.menuTrigger);
      if (!menuTrigger) {
        return {
          chatId: chat.id,
          provider: 'copilot',
          title: chat.title,
          success: false,
          status: 'failed',
          error: 'Could not find Copilot menu trigger button.',
          timestamp: Date.now(),
        };
      }

      await triggerHumanClick(menuTrigger);
      await sleep(80);

      const menu = await waitForElement<HTMLElement>(COPILOT_SELECTORS.menuPopup, document, 1500);
      if (!menu) {
        return {
          chatId: chat.id,
          provider: 'copilot',
          title: chat.title,
          success: false,
          status: 'failed',
          error: 'Copilot menu failed to open.',
          timestamp: Date.now(),
        };
      }

      let deleteItem = findElementWithText(menu, '[role="menuitem"], button, div', 'Delete');
      if (!deleteItem) deleteItem = queryWithFallbacks<HTMLElement>(menu, COPILOT_SELECTORS.deleteMenuItem);

      if (!deleteItem) {
        return {
          chatId: chat.id,
          provider: 'copilot',
          title: chat.title,
          success: false,
          status: 'failed',
          error: 'Could not find "Delete" in Copilot menu.',
          timestamp: Date.now(),
        };
      }

      await triggerHumanClick(deleteItem);
      await sleep(90);

      const dialog = await waitForElement<HTMLElement>(COPILOT_SELECTORS.confirmDialog, document, 1500);
      if (!dialog) {
        return {
          chatId: chat.id,
          provider: 'copilot',
          title: chat.title,
          success: false,
          status: 'unverified',
          error: 'Copilot confirmation dialog not displayed.',
          timestamp: Date.now(),
        };
      }

      let confirmBtn = findElementWithText(dialog, 'button', 'Delete');
      if (!confirmBtn) confirmBtn = queryWithFallbacks<HTMLElement>(dialog, COPILOT_SELECTORS.confirmDeleteButton);

      if (!confirmBtn) {
        return {
          chatId: chat.id,
          provider: 'copilot',
          title: chat.title,
          success: false,
          status: 'failed',
          error: 'Could not find Copilot confirmation Delete button.',
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
        provider: 'copilot',
        title: chat.title,
        success: verified,
        status: verified ? 'deleted' : 'unverified',
        timestamp: Date.now(),
      };
    } catch (err: any) {
      return {
        chatId: chat.id,
        provider: 'copilot',
        title: chat.title,
        success: false,
        status: 'failed',
        error: err?.message || 'Error automating Copilot deletion.',
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
