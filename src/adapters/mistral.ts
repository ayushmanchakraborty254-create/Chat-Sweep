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

export const MISTRAL_SELECTORS = {
  chatItem: [
    'a[href*="/chat/"]',
    'div[data-testid*="conversation-item"]',
    'div.conversation-row',
    'li:has(a[href*="/chat/"])',
  ],
  title: [
    'div.truncate',
    'span.truncate',
    'span[title]',
    'div[title]',
  ],
  menuTrigger: [
    'button[aria-label*="Options" i]',
    'button[aria-label*="More" i]',
    'button:has(svg.lucide-more-horizontal)',
    'button:has(svg)',
  ],
  menuPopup: [
    'div[role="menu"]',
    'div.radix-dropdown-content',
    'div[data-radix-popper-content-wrapper]',
  ],
  deleteMenuItem: [
    'div[role="menuitem"]:has-text("Delete")',
    'button[role="menuitem"]:has-text("Delete")',
    'button:has-text("Delete")',
  ],
  confirmDialog: [
    'div[role="dialog"]',
    'div[role="alertdialog"]',
  ],
  confirmDeleteButton: [
    'button:has-text("Delete")',
    'button.bg-red-500',
    'button.bg-destructive',
  ],
  scrollContainer: [
    'div[data-testid="conversation-list"]',
    'nav',
    'div.overflow-y-auto',
  ],
  userMenu: [
    'button[aria-label*="User" i]',
    'div[data-testid="user-menu"]',
  ],
};

export class MistralAdapter implements PlatformAdapter {
  public readonly id: ProviderId = 'mistral';
  public readonly name = 'Mistral Le Chat';
  public readonly matches = ['chat.mistral.ai'];
  public readonly isExperimental = true;

  public readonly capabilities: AdapterCapabilities = {
    bulkSelect: true,
    individualDelete: true,
    nativeBulkDelete: false,
    exportMetadata: true,
    guidedMode: false,
  };

  public readonly selectors = MISTRAL_SELECTORS;

  public isLoggedIn(): boolean {
    return !!(
      queryWithFallbacks(document, MISTRAL_SELECTORS.userMenu) ||
      queryWithFallbacks(document, MISTRAL_SELECTORS.scrollContainer) ||
      document.querySelector('textarea, div[contenteditable="true"]')
    );
  }

  public async getChatList(): Promise<ChatItem[]> {
    const elements = queryAllWithFallbacks<HTMLElement>(document, MISTRAL_SELECTORS.chatItem);
    const chats: ChatItem[] = [];
    const seenIds = new Set<string>();

    for (const el of elements) {
      const href = el.getAttribute('href') || el.querySelector('a')?.getAttribute('href') || '';
      let id = '';
      if (href) {
        const m = href.match(/\/chat\/([a-zA-Z0-9_\-]+)/);
        if (m) id = m[1];
      }
      if (!id) id = 'mistral_' + Math.abs(this.hashCode(el.textContent || ''));
      if (seenIds.has(id)) continue;
      seenIds.add(id);

      const titleEl = queryWithFallbacks(el, MISTRAL_SELECTORS.title);
      const title = (titleEl?.textContent || el.textContent || 'Untitled Chat').trim().replace(/\s+/g, ' ');

      chats.push({
        id,
        provider: 'mistral',
        title,
        url: href ? (href.startsWith('http') ? href : `https://chat.mistral.ai${href}`) : undefined,
        elementRef: el,
      });
    }

    return chats;
  }

  public observeChatList(callback: () => void): () => void {
    const target = queryWithFallbacks(document, MISTRAL_SELECTORS.scrollContainer) || document.body;
    const observer = new MutationObserver(() => callback());
    observer.observe(target, { childList: true, subtree: true });
    return () => observer.disconnect();
  }

  public async loadMoreChats(onProgress?: (count: number) => void): Promise<boolean> {
    const container = queryWithFallbacks<HTMLElement>(document, MISTRAL_SELECTORS.scrollContainer);
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
        provider: 'mistral',
        title: chat.title,
        success: false,
        status: 'failed',
        error: 'Mistral chat item not found in DOM.',
        timestamp: Date.now(),
      };
    }

    try {
      el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      await sleep(150);

      const menuTrigger = queryWithFallbacks<HTMLElement>(el, MISTRAL_SELECTORS.menuTrigger);
      if (!menuTrigger) {
        return {
          chatId: chat.id,
          provider: 'mistral',
          title: chat.title,
          success: false,
          status: 'failed',
          error: 'Could not find Mistral options menu trigger.',
          timestamp: Date.now(),
        };
      }

      await triggerHumanClick(menuTrigger);
      await sleep(250);

      const menu = await waitForElement<HTMLElement>(MISTRAL_SELECTORS.menuPopup, document, 2500);
      if (!menu) {
        return {
          chatId: chat.id,
          provider: 'mistral',
          title: chat.title,
          success: false,
          status: 'failed',
          error: 'Mistral options menu failed to open.',
          timestamp: Date.now(),
        };
      }

      let deleteItem = findElementWithText(menu, '[role="menuitem"], button, div', 'Delete');
      if (!deleteItem) deleteItem = queryWithFallbacks<HTMLElement>(menu, MISTRAL_SELECTORS.deleteMenuItem);

      if (!deleteItem) {
        return {
          chatId: chat.id,
          provider: 'mistral',
          title: chat.title,
          success: false,
          status: 'failed',
          error: 'Could not find "Delete" in Mistral menu.',
          timestamp: Date.now(),
        };
      }

      await triggerHumanClick(deleteItem);
      await sleep(350);

      const dialog = await waitForElement<HTMLElement>(MISTRAL_SELECTORS.confirmDialog, document, 3000);
      if (!dialog) {
        return {
          chatId: chat.id,
          provider: 'mistral',
          title: chat.title,
          success: false,
          status: 'unverified',
          error: 'Mistral delete confirmation modal did not open.',
          timestamp: Date.now(),
        };
      }

      let confirmBtn = findElementWithText(dialog, 'button', 'Delete');
      if (!confirmBtn) confirmBtn = queryWithFallbacks<HTMLElement>(dialog, MISTRAL_SELECTORS.confirmDeleteButton);

      if (!confirmBtn) {
        return {
          chatId: chat.id,
          provider: 'mistral',
          title: chat.title,
          success: false,
          status: 'failed',
          error: 'Could not locate Mistral confirmation Delete button.',
          timestamp: Date.now(),
        };
      }

      await triggerHumanClick(confirmBtn);
      const verified = await this.verifyDeletion(chat);

      return {
        chatId: chat.id,
        provider: 'mistral',
        title: chat.title,
        success: verified,
        status: verified ? 'deleted' : 'unverified',
        timestamp: Date.now(),
      };
    } catch (err: any) {
      return {
        chatId: chat.id,
        provider: 'mistral',
        title: chat.title,
        success: false,
        status: 'failed',
        error: err?.message || 'Error automating Mistral chat deletion.',
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
