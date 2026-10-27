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

export const DEEPSEEK_SELECTORS = {
  chatItem: [
    'div.ds-chat-item',
    'a[href*="/chat/"]',
    'div[class*="chat-item"]',
    'div[role="listitem"]',
    'div[class*="history-item"]',
  ],
  title: [
    'span.ds-chat-item-title',
    'div.truncate',
    'span.truncate',
    'div[title]',
    'span',
  ],
  menuTrigger: [
    'div.ds-chat-item-menu',
    'button[aria-label*="more" i]',
    'div[class*="actions"] button',
    'button:has(svg)',
  ],
  menuPopup: [
    'div.ds-dropdown-menu',
    'div[role="menu"]',
    'div.ant-dropdown',
    'ul.ant-dropdown-menu',
  ],
  deleteMenuItem: [
    'div[role="menuitem"]:has-text("Delete")',
    'li.ant-dropdown-menu-item:has-text("Delete")',
    'div:has-text("Delete")',
    'button:has-text("Delete")',
  ],
  confirmDialog: [
    'div.ds-modal',
    'div.ant-modal',
    'div[role="dialog"]',
  ],
  confirmDeleteButton: [
    'button.ds-button-danger',
    'button.ant-btn-dangerous',
    'button:has-text("Delete")',
    'button:has-text("Confirm")',
  ],
  scrollContainer: [
    'div.ds-chat-list',
    'div[class*="history-container"]',
    'nav',
    'div.overflow-y-auto',
  ],
  userMenu: [
    'div.ds-user-avatar',
    'div[class*="user-profile"]',
    'button[aria-label*="user" i]',
  ],
};

export class DeepSeekAdapter implements PlatformAdapter {
  public readonly id: ProviderId = 'deepseek';
  public readonly name = 'DeepSeek';
  public readonly matches = ['chat.deepseek.com'];
  public readonly isExperimental = true;

  public readonly capabilities: AdapterCapabilities = {
    bulkSelect: true,
    individualDelete: true,
    nativeBulkDelete: false,
    exportMetadata: true,
    guidedMode: false,
  };

  public readonly selectors = DEEPSEEK_SELECTORS;

  public isLoggedIn(): boolean {
    return !!(
      queryWithFallbacks(document, DEEPSEEK_SELECTORS.userMenu) ||
      queryWithFallbacks(document, DEEPSEEK_SELECTORS.scrollContainer) ||
      document.querySelector('textarea, input[placeholder*="DeepSeek"]')
    );
  }

  public async getChatList(): Promise<ChatItem[]> {
    const elements = queryAllWithFallbacks<HTMLElement>(document, DEEPSEEK_SELECTORS.chatItem);
    const chats: ChatItem[] = [];
    const seenIds = new Set<string>();

    for (const el of elements) {
      const href = el.getAttribute('href') || el.querySelector('a')?.getAttribute('href') || '';
      let id = '';
      if (href) {
        const m = href.match(/\/chat\/([a-zA-Z0-9_\-]+)/);
        if (m) id = m[1];
      }
      if (!id) id = el.getAttribute('data-id') || 'ds_' + Math.abs(this.hashCode(el.textContent || ''));
      if (seenIds.has(id)) continue;
      seenIds.add(id);

      const titleEl = queryWithFallbacks(el, DEEPSEEK_SELECTORS.title);
      const title = (titleEl?.textContent || el.textContent || 'Untitled Chat').trim().replace(/\s+/g, ' ');

      chats.push({
        id,
        provider: 'deepseek',
        title,
        url: href ? (href.startsWith('http') ? href : `https://chat.deepseek.com${href}`) : undefined,
        elementRef: el,
      });
    }

    return chats;
  }

  public observeChatList(callback: () => void): () => void {
    const target = queryWithFallbacks(document, DEEPSEEK_SELECTORS.scrollContainer) || document.body;
    const observer = new MutationObserver(() => callback());
    observer.observe(target, { childList: true, subtree: true });
    return () => observer.disconnect();
  }

  public async loadMoreChats(onProgress?: (count: number) => void): Promise<boolean> {
    const container = queryWithFallbacks<HTMLElement>(document, DEEPSEEK_SELECTORS.scrollContainer);
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
        provider: 'deepseek',
        title: chat.title,
        success: false,
        status: 'failed',
        error: 'DeepSeek chat item not found in DOM.',
        timestamp: Date.now(),
      };
    }

    try {
      el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      await sleep(150);

      const menuTrigger = queryWithFallbacks<HTMLElement>(el, DEEPSEEK_SELECTORS.menuTrigger);
      if (!menuTrigger) {
        return {
          chatId: chat.id,
          provider: 'deepseek',
          title: chat.title,
          success: false,
          status: 'failed',
          error: 'Could not find DeepSeek menu trigger.',
          timestamp: Date.now(),
        };
      }

      await triggerHumanClick(menuTrigger);
      await sleep(250);

      const menu = await waitForElement<HTMLElement>(DEEPSEEK_SELECTORS.menuPopup, document, 2500);
      if (!menu) {
        return {
          chatId: chat.id,
          provider: 'deepseek',
          title: chat.title,
          success: false,
          status: 'failed',
          error: 'DeepSeek menu failed to open.',
          timestamp: Date.now(),
        };
      }

      let deleteItem = findElementWithText(menu, '[role="menuitem"], li, div', 'Delete');
      if (!deleteItem) deleteItem = queryWithFallbacks<HTMLElement>(menu, DEEPSEEK_SELECTORS.deleteMenuItem);

      if (!deleteItem) {
        return {
          chatId: chat.id,
          provider: 'deepseek',
          title: chat.title,
          success: false,
          status: 'failed',
          error: 'Could not find "Delete" in DeepSeek dropdown.',
          timestamp: Date.now(),
        };
      }

      await triggerHumanClick(deleteItem);
      await sleep(350);

      const dialog = await waitForElement<HTMLElement>(DEEPSEEK_SELECTORS.confirmDialog, document, 3000);
      if (!dialog) {
        return {
          chatId: chat.id,
          provider: 'deepseek',
          title: chat.title,
          success: false,
          status: 'unverified',
          error: 'DeepSeek confirmation dialog not shown.',
          timestamp: Date.now(),
        };
      }

      let confirmBtn = findElementWithText(dialog, 'button', 'Delete');
      if (!confirmBtn) confirmBtn = findElementWithText(dialog, 'button', 'Confirm');
      if (!confirmBtn) confirmBtn = queryWithFallbacks<HTMLElement>(dialog, DEEPSEEK_SELECTORS.confirmDeleteButton);

      if (!confirmBtn) {
        return {
          chatId: chat.id,
          provider: 'deepseek',
          title: chat.title,
          success: false,
          status: 'failed',
          error: 'DeepSeek confirmation button not found.',
          timestamp: Date.now(),
        };
      }

      await triggerHumanClick(confirmBtn);
      const verified = await this.verifyDeletion(chat);

      return {
        chatId: chat.id,
        provider: 'deepseek',
        title: chat.title,
        success: verified,
        status: verified ? 'deleted' : 'unverified',
        timestamp: Date.now(),
      };
    } catch (err: any) {
      return {
        chatId: chat.id,
        provider: 'deepseek',
        title: chat.title,
        success: false,
        status: 'failed',
        error: err?.message || 'Error automating DeepSeek deletion.',
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
