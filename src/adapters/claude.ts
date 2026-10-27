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

/**
 * Selectors centralized with resilient fallbacks for Claude.ai
 */
export const CLAUDE_SELECTORS = {
  chatItem: [
    'li:has(a[href*="/chat/"])',
    'div[data-testid="chat-item"]',
    'nav div[role="button"]:has(a[href*="/chat/"])',
    'div.group:has(a[href*="/chat/"])',
    'a[href*="/chat/"]',
  ],
  title: [
    'div.truncate',
    'span.truncate',
    'p.truncate',
    'div[title]',
    'span[title]',
    'a[href*="/chat/"] span',
  ],
  menuTrigger: [
    'button[aria-label*="Chat options"]',
    'button[aria-label*="options" i]',
    'button[data-testid="chat-menu-trigger"]',
    'button[data-testid="overflow-menu-trigger"]',
    'button:has(svg.lucide-more-horizontal)',
    'button:has(svg.lucide-ellipsis)',
    'button:has(svg[aria-label*="More" i])',
  ],
  menuPopup: [
    'div[role="menu"]',
    'div[data-radix-popper-content-wrapper]',
    'div.radix-dropdown-content',
    'div[data-testid="chat-menu-content"]',
  ],
  deleteMenuItem: [
    'div[role="menuitem"]:has-text("Delete")',
    'button[role="menuitem"]:has-text("Delete")',
    'div[data-testid="delete-chat"]',
    '[role="menuitem"]',
  ],
  confirmDialog: [
    'div[role="dialog"]',
    'div[role="alertdialog"]',
    'div[data-testid="confirm-dialog"]',
  ],
  confirmDeleteButton: [
    'button[data-testid="confirm-delete"]',
    'button.bg-danger',
    'button.bg-red-500',
    'div[role="dialog"] button',
  ],
  scrollContainer: [
    'nav[aria-label*="history" i]',
    'nav[aria-label*="Recent chats" i]',
    'nav div.overflow-y-auto',
    'nav',
  ],
  userMenu: [
    'button[aria-label*="User menu" i]',
    'button[data-testid="user-menu"]',
    'button[aria-haspopup="menu"]',
    'a[href="/settings"]',
  ],
};

export class ClaudeAdapter implements PlatformAdapter {
  public readonly id: ProviderId = 'claude';
  public readonly name = 'Claude';
  public readonly matches = ['claude.ai'];
  public readonly isExperimental = false;

  public readonly capabilities: AdapterCapabilities = {
    bulkSelect: true,
    individualDelete: true,
    nativeBulkDelete: false,
    exportMetadata: true,
    guidedMode: false,
  };

  public readonly selectors = CLAUDE_SELECTORS;
  private cachedChatTitles = new Map<string, string>();
  private isFetchingTitles = false;

  public isLoggedIn(): boolean {
    const userElement = queryWithFallbacks(document, CLAUDE_SELECTORS.userMenu);
    const nav = queryWithFallbacks(document, CLAUDE_SELECTORS.scrollContainer);
    return !!(userElement || nav || document.cookie.includes('sessionKey'));
  }

  public async getChatList(): Promise<ChatItem[]> {
    // Optionally trigger background server title fetch
    if (this.cachedChatTitles.size === 0 && !this.isFetchingTitles) {
      this.fetchServerChatTitles().catch(() => {});
    }

    const chatElements = queryAllWithFallbacks<HTMLElement>(
      document,
      CLAUDE_SELECTORS.chatItem
    );

    const chats: ChatItem[] = [];
    const seenIds = new Set<string>();

    for (const el of chatElements) {
      let href = el.getAttribute('href');
      if (!href) {
        const linkChild = el.querySelector<HTMLAnchorElement>('a[href*="/chat/"]');
        if (linkChild) href = linkChild.getAttribute('href');
      }

      let id = '';
      if (href) {
        const match = href.match(/\/chat\/([a-zA-Z0-9\-]+)/);
        if (match) id = match[1];
      }

      if (!id) {
        id = el.getAttribute('data-chat-id') || el.getAttribute('id') || '';
      }

      if (!id) {
        // Fallback to text hash if no explicit ID
        const text = el.textContent || '';
        id = 'claude_' + Math.abs(this.hashCode(text));
      }

      if (seenIds.has(id)) continue;
      seenIds.add(id);

      // Hierarchical Title Extraction to prevent "Untitled Chat"
      let title = '';

      // 1. Direct aria-label or title attributes on element or its anchor
      const directAria = el.getAttribute('aria-label') || el.getAttribute('title');
      if (
        directAria &&
        !directAria.toLowerCase().includes('option') &&
        !directAria.toLowerCase().includes('menu') &&
        directAria !== 'Chat'
      ) {
        title = directAria;
      }

      // 2. Query title selector within element
      if (!title) {
        const titleEl = queryWithFallbacks(el, CLAUDE_SELECTORS.title);
        if (titleEl) {
          title = (
            titleEl.textContent ||
            titleEl.getAttribute('title') ||
            titleEl.getAttribute('aria-label') ||
            ''
          ).trim();
        }
      }

      // 3. Search the enclosing row container (li, div.group, parent)
      const container =
        el.closest('li, div.group, [data-testid="chat-item"], div[role="button"]') ||
        el.parentElement;

      if ((!title || title === 'Untitled Chat') && container) {
        const cAria = container.getAttribute('aria-label') || container.getAttribute('title');
        if (
          cAria &&
          !cAria.toLowerCase().includes('option') &&
          !cAria.toLowerCase().includes('menu') &&
          cAria !== 'Chat'
        ) {
          title = cAria;
        }

        if (!title || title === 'Untitled Chat') {
          const cTitleEl = queryWithFallbacks(container, CLAUDE_SELECTORS.title);
          if (cTitleEl) {
            title = (cTitleEl.textContent || cTitleEl.getAttribute('title') || '').trim();
          }
        }

        if (!title || title === 'Untitled Chat') {
          // Look for candidates inside container excluding action buttons
          const candidates = Array.from(
            container.querySelectorAll<HTMLElement>(
              '[class*="truncate"], [class*="line-clamp"], div[title], span[title], p, span, div'
            )
          );
          for (const cand of candidates) {
            if (cand.closest('button, svg, .cs-checkbox-btn, [role="button"]')) continue;
            const text = (cand.getAttribute('title') || cand.textContent || '').trim();
            if (
              text &&
              text.length > 0 &&
              text !== 'Untitled Chat' &&
              !text.toLowerCase().includes('delete') &&
              !text.toLowerCase().includes('rename') &&
              !text.toLowerCase().includes('select') &&
              !text.toLowerCase().includes('options') &&
              !text.startsWith('Claude')
            ) {
              title = text;
              break;
            }
          }
        }

        if (!title || title === 'Untitled Chat') {
          // Clone container and strip buttons, svgs, scripts, checkboxes
          try {
            const clone = container.cloneNode(true) as HTMLElement;
            clone
              .querySelectorAll('button, svg, .cs-checkbox-btn, [role="button"], script, style')
              .forEach((node) => node.remove());
            const raw = (clone.textContent || '').replace(/\s+/g, ' ').trim();
            if (raw && raw !== 'Untitled Chat' && raw.length > 0) {
              title = raw;
            }
          } catch {}
        }
      }

      // 4. Check server cached titles
      if ((!title || title === 'Untitled Chat') && id && this.cachedChatTitles.has(id)) {
        title = this.cachedChatTitles.get(id)!;
      }

      // 5. Fallback to direct textContent
      if (!title) {
        title = (el.textContent || '').trim();
      }

      // Clean title from extra UI labels
      title = title.replace(/\s+/g, ' ').trim() || 'Untitled Chat';

      // Pinned check
      const isPinned =
        el.closest('[data-testid="pinned-chats"]') !== null ||
        el.querySelector('[data-testid="pin-icon"]') !== null;

      chats.push({
        id,
        provider: 'claude',
        title,
        url: href ? (href.startsWith('http') ? href : `https://claude.ai${href}`) : undefined,
        elementRef: el,
        isPinned,
      });
    }

    return chats;
  }

  public observeChatList(callback: () => void): () => void {
    const target =
      queryWithFallbacks(document, CLAUDE_SELECTORS.scrollContainer) || document.body;
    const observer = new MutationObserver((mutations) => {
      const isOnlyChatSweep = mutations.every((m) => {
        const targetEl = m.target as HTMLElement | null;
        if (!targetEl) return false;
        return (
          targetEl.tagName?.toLowerCase() === 'chatsweep-root' ||
          targetEl.classList?.contains('cs-checkbox-btn') ||
          targetEl.classList?.contains('cs-has-checkbox') ||
          targetEl.classList?.contains('cs-row-selected') ||
          targetEl.id === 'chatsweep-injected-host-styles' ||
          Boolean(targetEl.closest?.('#chatsweep-shadow-host'))
        );
      });
      if (!isOnlyChatSweep) {
        callback();
      }
    });

    observer.observe(target, { childList: true, subtree: true });
    return () => observer.disconnect();
  }

  public async loadMoreChats(onProgress?: (count: number) => void): Promise<boolean> {
    const container = queryWithFallbacks<HTMLElement>(
      document,
      CLAUDE_SELECTORS.scrollContainer
    );
    if (!container) return false;

    let previousHeight = 0;
    let attemptsWithoutNewChats = 0;

    for (let i = 0; i < 25; i++) {
      const initialChats = (await this.getChatList()).length;
      onProgress?.(initialChats);

      container.scrollTop = container.scrollHeight;
      await sleep(700);

      const currentChats = (await this.getChatList()).length;
      const currentHeight = container.scrollHeight;

      if (currentChats === initialChats && currentHeight === previousHeight) {
        attemptsWithoutNewChats++;
        if (attemptsWithoutNewChats >= 3) {
          break; // Fully loaded
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

  public async fetchServerChatTitles(): Promise<void> {
    if (this.isFetchingTitles) return;
    this.isFetchingTitles = true;
    try {
      const orgId = await this.getClaudeOrgId();
      if (!orgId) return;
      const res = await fetch(`/api/organizations/${orgId}/chat_conversations`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      });
      if (res.ok) {
        const list = await res.json();
        if (Array.isArray(list)) {
          for (const item of list) {
            if (item.uuid && item.name) {
              this.cachedChatTitles.set(item.uuid, item.name);
            }
          }
        }
      }
    } catch {} finally {
      this.isFetchingTitles = false;
    }
  }

  private cachedOrgId: string | null = null;

  private async getClaudeOrgId(): Promise<string | null> {
    if (this.cachedOrgId) return this.cachedOrgId;

    // 1. Instant check: cookies (synchronous)
    try {
      const match = document.cookie.match(/lastActiveOrg=([a-zA-Z0-9_\-]+)/);
      if (match && match[1]) {
        this.cachedOrgId = match[1];
        return match[1];
      }
    } catch {}

    // 2. Instant check: URL path
    const urlMatch = location.pathname.match(/organizations\/([a-f0-9\-]{36})/i);
    if (urlMatch && urlMatch[1]) {
      this.cachedOrgId = urlMatch[1];
      return urlMatch[1];
    }

    // 3. Instant check: localStorage & sessionStorage
    try {
      for (const storage of [localStorage, sessionStorage]) {
        for (let i = 0; i < storage.length; i++) {
          const key = storage.key(i) || '';
          const val = storage.getItem(key) || '';
          if (key.includes('org') || val.includes('organization') || val.includes('uuid')) {
            const match = val.match(
              /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i
            );
            if (match && match[1]) {
              this.cachedOrgId = match[1];
              return match[1];
            }
          }
        }
      }
    } catch {}

    // 4. Official Claude API endpoint
    try {
      const res = await fetch('/api/organizations', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const orgId = data[0].uuid || data[0].id;
          if (orgId) {
            this.cachedOrgId = orgId;
            return orgId;
          }
        }
      }
    } catch {}

    // 5. Check __NEXT_DATA__
    try {
      const nextDataEl = document.getElementById('__NEXT_DATA__');
      if (nextDataEl?.textContent) {
        const match =
          nextDataEl.textContent.match(/"organization[_-]?uuid"\s*:\s*"([a-f0-9\-]{36})"/i) ||
          nextDataEl.textContent.match(/"org[_-]?id"\s*:\s*"([a-f0-9\-]{36})"/i) ||
          nextDataEl.textContent.match(/"uuid"\s*:\s*"([a-f0-9\-]{36})"/i);
        if (match && match[1]) {
          this.cachedOrgId = match[1];
          return match[1];
        }
      }
    } catch {}

    return null;
  }

  private async deleteViaClaudeApi(chatId: string): Promise<boolean> {
    try {
      const orgId = await this.getClaudeOrgId();
      if (!orgId) return false;

      const res = await fetch(`/api/organizations/${orgId}/chat_conversations/${chatId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      });

      if (res.ok || res.status === 204 || res.status === 200 || res.status === 404) {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  public async deleteChat(chat: ChatItem): Promise<DeleteResult> {
    // Locate the DOM element
    let el = chat.elementRef;
    if (!el || !document.body.contains(el)) {
      try {
        el = document.querySelector(`a[href*="${CSS.escape(chat.id)}"]`) as HTMLElement;
      } catch {}
    }
    if (!el) {
      const anchors = Array.from(
        document.querySelectorAll<HTMLElement>('nav a, a[href*="/chat/"], li a')
      );
      el = anchors.find((a) => (a.textContent || '').trim().includes(chat.title)) || null;
    }

    // 1. PRIMARY STRATEGY: Direct API deletion (instant, permanent, no UI flakiness)
    if (chat.id && !chat.id.startsWith('claude_')) {
      const apiSuccess = await this.deleteViaClaudeApi(chat.id);
      if (apiSuccess) {
        if (el) {
          const row = el.closest('li, div.group, div[role="button"]') || el;
          row.remove();
        }
        return {
          chatId: chat.id,
          provider: 'claude',
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
        provider: 'claude',
        title: chat.title,
        success: false,
        status: 'failed',
        error: 'Chat element was not found in the sidebar.',
        timestamp: Date.now(),
      };
    }

    try {
      // Find row container
      let row: HTMLElement = el;
      for (let i = 0; i < 4; i++) {
        if (!row.parentElement || row.parentElement.tagName === 'NAV') break;
        row = row.parentElement;
        if (row.querySelector('button:not(.cs-checkbox-btn)')) break;
      }

      // Hover element to trigger React hover state
      row.scrollIntoView({ block: 'nearest' });
      ['pointerenter', 'pointerover', 'mouseenter', 'mouseover'].forEach((ev) => {
        try {
          row.dispatchEvent(
            new PointerEvent(ev, { bubbles: true, cancelable: true, pointerType: 'mouse' })
          );
        } catch {}
        try {
          row.dispatchEvent(new MouseEvent(ev, { bubbles: true, cancelable: true }));
        } catch {}
      });
      await sleep(40);

      // Find menu trigger button
      const candidateButtons = Array.from(
        row.querySelectorAll<HTMLElement>('button:not(.cs-checkbox-btn)')
      );
      let menuTrigger =
        candidateButtons.find((b) => {
          const aria = (b.getAttribute('aria-label') || '').toLowerCase();
          const popup = b.getAttribute('aria-haspopup');
          return (
            popup === 'menu' ||
            aria.includes('option') ||
            aria.includes('more') ||
            aria.includes('menu') ||
            b.querySelector('svg') !== null
          );
        }) ||
        candidateButtons[0] ||
        null;

      if (!menuTrigger) {
        return {
          chatId: chat.id,
          provider: 'claude',
          title: chat.title,
          success: false,
          status: 'failed',
          error: 'Could not find Claude chat options menu trigger button.',
          timestamp: Date.now(),
        };
      }

      // Click menu trigger button
      menuTrigger.focus();
      ['pointerdown', 'mousedown', 'pointerup', 'mouseup'].forEach((ev) => {
        try {
          menuTrigger.dispatchEvent(
            new PointerEvent(ev, { bubbles: true, cancelable: true, pointerType: 'mouse' })
          );
        } catch {}
        try {
          menuTrigger.dispatchEvent(new MouseEvent(ev, { bubbles: true, cancelable: true }));
        } catch {}
      });
      if (typeof menuTrigger.click === 'function') menuTrigger.click();
      await sleep(80);

      // Wait for Menu Popup
      const menu = await waitForElement<HTMLElement>(
        ['div[role="menu"]', '[data-radix-popper-content-wrapper]', 'div[data-state="open"]'],
        document,
        1500
      );

      // Find Delete in menu
      const allMenuElements = Array.from(
        document.querySelectorAll<HTMLElement>(
          '[role="menuitem"], div[role="menu"] *, [data-radix-popper-content-wrapper] *'
        )
      );
      const deleteItem = allMenuElements.find((item) => {
        const text = (item.textContent || '').trim().toLowerCase();
        return (
          text === 'delete' ||
          text.includes('delete chat') ||
          text.includes('delete conversation') ||
          text.startsWith('delete')
        );
      });

      if (!deleteItem) {
        return {
          chatId: chat.id,
          provider: 'claude',
          title: chat.title,
          success: false,
          status: 'failed',
          error: 'Could not find "Delete" option in menu.',
          timestamp: Date.now(),
        };
      }

      deleteItem.focus();
      ['pointerdown', 'mousedown', 'pointerup', 'mouseup'].forEach((ev) => {
        try {
          deleteItem.dispatchEvent(
            new PointerEvent(ev, { bubbles: true, cancelable: true, pointerType: 'mouse' })
          );
        } catch {}
        try {
          deleteItem.dispatchEvent(new MouseEvent(ev, { bubbles: true, cancelable: true }));
        } catch {}
      });
      if (typeof deleteItem.click === 'function') deleteItem.click();
      await sleep(90);

      // Wait for confirmation dialog
      const dialog = await waitForElement<HTMLElement>(
        ['div[role="dialog"]', 'div[role="alertdialog"]', 'div[data-state="open"]'],
        document,
        1500
      );

      if (dialog) {
        const dialogButtons = Array.from(dialog.querySelectorAll<HTMLElement>('button'));
        const confirmBtn =
          dialogButtons.find((b) => {
            const text = (b.textContent || '').trim().toLowerCase();
            return (
              text === 'delete' ||
              text.includes('delete') ||
              b.classList.contains('bg-danger') ||
              b.classList.contains('bg-red-500')
            );
          }) || dialogButtons[dialogButtons.length - 1];

        if (confirmBtn) {
          confirmBtn.focus();
          ['pointerdown', 'mousedown', 'pointerup', 'mouseup'].forEach((ev) => {
            try {
              confirmBtn.dispatchEvent(
                new PointerEvent(ev, { bubbles: true, cancelable: true, pointerType: 'mouse' })
              );
            } catch {}
            try {
              confirmBtn.dispatchEvent(new MouseEvent(ev, { bubbles: true, cancelable: true }));
            } catch {}
          });
          if (typeof confirmBtn.click === 'function') confirmBtn.click();
        }
      }

      // Fast verification of deletion
      const verified = await this.verifyDeletion(chat);
      if (verified && el) {
        const row = el.closest('li, div.group, div[role="button"]') || el;
        row.remove();
      }

      return {
        chatId: chat.id,
        provider: 'claude',
        title: chat.title,
        success: verified,
        status: verified ? 'deleted' : 'unverified',
        timestamp: Date.now(),
      };
    } catch (err: any) {
      return {
        chatId: chat.id,
        provider: 'claude',
        title: chat.title,
        success: false,
        status: 'failed',
        error: err?.message || 'Error occurred during deletion automation.',
        timestamp: Date.now(),
      };
    }
  }

  public async verifyDeletion(chat: ChatItem): Promise<boolean> {
    // 1. Immediate check: 0ms wait if element was already removed from DOM
    if (chat.elementRef && !document.body.contains(chat.elementRef)) {
      return true;
    }
    if (chat.id && !document.querySelector(`a[href*="${chat.id}"]`)) {
      return true;
    }
    // 2. Poll in short intervals
    for (let i = 0; i < 6; i++) {
      await sleep(30);
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
