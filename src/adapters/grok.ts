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

export const GROK_SELECTORS = {
  chatItem: [
    'a[href*="/chat/"]',
    'a[href*="/grok/"]',
    'div[data-testid*="conversation-item"]',
    'div[data-testid*="grok-history"]',
  ],
  title: [
    'span.truncate',
    'div.truncate',
    'span[title]',
    'div[title]',
  ],
  menuTrigger: [
    'button[aria-label*="More options" i]',
    'button[aria-label*="Conversation options" i]',
    'button[data-testid*="overflow-menu"]',
    'button:has(svg)',
  ],
  menuPopup: [
    'div[role="menu"]',
    'div[data-testid="Dropdown"]',
    'div[data-testid="Sheet"]',
  ],
  deleteMenuItem: [
    'div[role="menuitem"]:has-text("Delete")',
    'button[role="menuitem"]:has-text("Delete")',
    'div[data-testid*="delete"]',
  ],
  confirmDialog: [
    'div[role="alertdialog"]',
    'div[role="dialog"]',
    'div[data-testid="confirmationSheet"]',
  ],
  confirmDeleteButton: [
    'button[data-testid*="confirmationSheetConfirm"]',
    'button:has-text("Delete")',
  ],
  scrollContainer: [
    'div[data-testid="grok-history-list"]',
    'nav',
    'div.overflow-y-auto',
  ],
  userMenu: [
    'div[data-testid="CurrentUser_Profile"]',
    'button[aria-label*="Account" i]',
  ],
};

export class GrokAdapter implements PlatformAdapter {
  public readonly id: ProviderId = 'grok';
  public readonly name = 'Grok';
  public readonly matches = ['grok.com', 'x.com'];
  public readonly isExperimental = true;

  public readonly capabilities: AdapterCapabilities = {
    bulkSelect: true,
    individualDelete: true,
    nativeBulkDelete: false,
    exportMetadata: true,
    guidedMode: false,
  };

  public readonly selectors = GROK_SELECTORS;

  public isLoggedIn(): boolean {
    return !!(
      queryWithFallbacks(document, GROK_SELECTORS.userMenu) ||
      queryWithFallbacks(document, GROK_SELECTORS.scrollContainer) ||
      document.querySelector('textarea, input[placeholder*="Ask anything"]')
    );
  }

  public async getChatList(): Promise<ChatItem[]> {
    const elements = queryAllWithFallbacks<HTMLElement>(document, GROK_SELECTORS.chatItem);
    const chats: ChatItem[] = [];
    const seenIds = new Set<string>();

    for (const el of elements) {
      const href = el.getAttribute('href') || el.querySelector('a')?.getAttribute('href') || '';
      let id = '';
      if (href) {
        const m = href.match(/\/(chat|grok)\/([a-zA-Z0-9_\-]+)/);
        if (m) id = m[2];
      }
      if (!id) id = el.getAttribute('data-testid') || 'grok_' + Math.abs(this.hashCode(el.textContent || ''));
      if (seenIds.has(id)) continue;
      seenIds.add(id);

      let title = '';
      const titleEl = queryWithFallbacks(el, GROK_SELECTORS.title);
      title = (titleEl?.textContent || el.textContent || 'Untitled Chat').trim().replace(/\s+/g, ' ');

      chats.push({
        id,
        provider: 'grok',
        title,
        url: href ? (href.startsWith('http') ? href : `https://grok.com${href}`) : undefined,
        elementRef: el,
      });
    }

    return chats;
  }

  public observeChatList(callback: () => void): () => void {
    const target = queryWithFallbacks(document, GROK_SELECTORS.scrollContainer) || document.body;
    const observer = new MutationObserver(() => callback());
    observer.observe(target, { childList: true, subtree: true });
    return () => observer.disconnect();
  }

  public async loadMoreChats(onProgress?: (count: number) => void): Promise<boolean> {
    const container = queryWithFallbacks<HTMLElement>(document, GROK_SELECTORS.scrollContainer);
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
        provider: 'grok',
        title: chat.title,
        success: false,
        status: 'failed',
        error: 'Grok chat item not found in DOM.',
        timestamp: Date.now(),
      };
    }

    try {
      el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      await sleep(150);

      const menuTrigger = queryWithFallbacks<HTMLElement>(el, GROK_SELECTORS.menuTrigger);
      if (!menuTrigger) {
        return {
          chatId: chat.id,
          provider: 'grok',
          title: chat.title,
          success: false,
          status: 'failed',
          error: 'Could not find Grok menu trigger button.',
          timestamp: Date.now(),
        };
      }

      await triggerHumanClick(menuTrigger);
      await sleep(250);

      const menu = await waitForElement<HTMLElement>(GROK_SELECTORS.menuPopup, document, 2500);
      if (!menu) {
        return {
          chatId: chat.id,
          provider: 'grok',
          title: chat.title,
          success: false,
          status: 'failed',
          error: 'Grok menu dropdown failed to open.',
          timestamp: Date.now(),
        };
      }

      let deleteItem = findElementWithText(menu, '[role="menuitem"], button, div', 'Delete');
      if (!deleteItem) deleteItem = queryWithFallbacks<HTMLElement>(menu, GROK_SELECTORS.deleteMenuItem);

      if (!deleteItem) {
        return {
          chatId: chat.id,
          provider: 'grok',
          title: chat.title,
          success: false,
          status: 'failed',
          error: 'Could not find "Delete" in Grok menu.',
          timestamp: Date.now(),
        };
      }

      await triggerHumanClick(deleteItem);
      await sleep(350);

      const dialog = await waitForElement<HTMLElement>(GROK_SELECTORS.confirmDialog, document, 3000);
      if (!dialog) {
        return {
          chatId: chat.id,
          provider: 'grok',
          title: chat.title,
          success: false,
          status: 'unverified',
          error: 'Grok confirmation dialog not displayed.',
          timestamp: Date.now(),
        };
      }

      let confirmBtn = findElementWithText(dialog, 'button', 'Delete');
      if (!confirmBtn) confirmBtn = queryWithFallbacks<HTMLElement>(dialog, GROK_SELECTORS.confirmDeleteButton);

      if (!confirmBtn) {
        return {
          chatId: chat.id,
          provider: 'grok',
          title: chat.title,
          success: false,
          status: 'failed',
          error: 'Grok confirmation Delete button not found.',
          timestamp: Date.now(),
        };
      }

      await triggerHumanClick(confirmBtn);
      const verified = await this.verifyDeletion(chat);

      return {
        chatId: chat.id,
        provider: 'grok',
        title: chat.title,
        success: verified,
        status: verified ? 'deleted' : 'unverified',
        timestamp: Date.now(),
      };
    } catch (err: any) {
      return {
        chatId: chat.id,
        provider: 'grok',
        title: chat.title,
        success: false,
        status: 'failed',
        error: err?.message || 'Error automating Grok chat deletion.',
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
