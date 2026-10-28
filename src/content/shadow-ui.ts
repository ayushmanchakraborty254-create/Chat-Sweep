import { ChatItem, PlatformAdapter, QueueProgress, Settings } from '../types';
import { SelectionManager } from '../core/selection';
import { DeletionQueue } from '../core/queue';
import { exportChatsToCSV, exportChatsToJSON, triggerFileDownload } from '../core/export';
import { filterChatList } from '../utils/date-filters';
import { getUIPositions, saveUIPositions, saveSettings } from '../core/storage';
import shadowStyles from './styles.css?inline';

export class ShadowUIManager {
  private host: HTMLElement;
  private shadow: ShadowRoot;
  private adapter: PlatformAdapter;
  private settings: Settings;
  private selection: SelectionManager;
  private queue: DeletionQueue | null = null;

  private isSelectionMode = false;
  private isCollapsed = false;
  private chats: ChatItem[] = [];
  private filteredChats: ChatItem[] = [];
  private searchQuery = '';
  private currentModal: 'none' | 'confirm' | 'progress' = 'none';
  private lastProgress: QueueProgress | null = null;
  private dryRunActive = false;
  private triggerPos: { x: number; y: number } | null = null;
  private actionBarPos: { x: number; y: number } | null = null;
  private actionBarDock: 'top' | 'bottom' | 'free' = 'bottom';

  constructor(adapter: PlatformAdapter, settings: Settings) {
    this.adapter = adapter;
    this.settings = settings;
    this.selection = new SelectionManager();
    this.dryRunActive = settings.dryRunMode;

    // Restore saved positions synchronously from localStorage if available
    try {
      const savedTrigger = localStorage.getItem('chatsweep_trigger_pos');
      if (savedTrigger) this.triggerPos = JSON.parse(savedTrigger);
      const savedBar = localStorage.getItem('chatsweep_action_bar_pos');
      if (savedBar) this.actionBarPos = JSON.parse(savedBar);
      const savedDock = localStorage.getItem('chatsweep_action_bar_dock');
      if (savedDock === 'top' || savedDock === 'bottom' || savedDock === 'free') {
        this.actionBarDock = savedDock;
      }
    } catch {}

    // Synchronize asynchronously with chrome.storage.local
    getUIPositions().then((pos) => {
      let shouldRerender = false;
      if (pos.triggerPos && (!this.triggerPos || pos.triggerPos.x !== this.triggerPos.x || pos.triggerPos.y !== this.triggerPos.y)) {
        this.triggerPos = pos.triggerPos;
        shouldRerender = true;
      }
      if (pos.actionBarPos) {
        this.actionBarPos = pos.actionBarPos;
        shouldRerender = true;
      }
      if (typeof pos.isCollapsed === 'boolean' && pos.isCollapsed !== this.isCollapsed) {
        this.isCollapsed = pos.isCollapsed;
        shouldRerender = true;
      }
      if (pos.actionBarDock && pos.actionBarDock !== this.actionBarDock) {
        this.actionBarDock = pos.actionBarDock;
        shouldRerender = true;
      }
      if (shouldRerender) {
        this.render();
      }
    });

    window.addEventListener('resize', () => this.repositionElementsOnResize());

    // Create shadow host
    this.host = document.createElement('chatsweep-root');
    this.host.id = 'chatsweep-shadow-host';
    this.shadow = this.host.attachShadow({ mode: 'open' });

    // Detect theme
    this.updateTheme();

    // Attach styles
    const styleEl = document.createElement('style');
    styleEl.textContent = shadowStyles;
    this.shadow.appendChild(styleEl);

    // Initial render
    this.render();
  }

  public mount(): void {
    if (!document.body.contains(this.host)) {
      document.body.appendChild(this.host);
    }
  }

  public unmount(): void {
    if (document.body.contains(this.host)) {
      document.body.removeChild(this.host);
    }
    this.removeSidebarCheckboxes();
  }

  public updateTheme(): void {
    const isDark =
      document.documentElement.classList.contains('dark') ||
      document.body.classList.contains('dark') ||
      document.documentElement.getAttribute('data-theme') === 'dark' ||
      window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (isDark) {
      this.host.classList.add('dark');
      this.host.setAttribute('data-theme', 'dark');
    } else {
      this.host.classList.remove('dark');
      this.host.removeAttribute('data-theme');
    }
  }

  public setChats(chats: ChatItem[]): void {
    this.chats = chats;
    this.applyFilter();
    if (this.isSelectionMode) {
      this.syncSidebarCheckboxes();
      if (this.currentModal !== 'progress') {
        this.render();
      }
    }
  }

  public async toggleSelectionMode(): Promise<void> {
    this.isSelectionMode = !this.isSelectionMode;
    if (this.isSelectionMode) {
      try {
        const latest = await this.adapter.getChatList();
        if (latest.length > 0) {
          this.chats = latest;
          this.applyFilter();
        }
      } catch (e) {
        console.error('[ChatSweep] Error updating chat list:', e);
      }
      this.syncSidebarCheckboxes();
    } else {
      this.removeSidebarCheckboxes();
      this.selection.deselectAll();
    }
    this.render();
  }

  public handleChatToggle(chatId: string, isShift: boolean): void {
    this.selection.toggle(chatId, isShift, this.filteredChats);
    this.updateCheckboxesAppearance();
    this.updateActionBarState();
  }

  private applyFilter(): void {
    this.filteredChats = filterChatList(this.chats, {
      searchQuery: this.searchQuery,
      excludeQuery: '',
      dateRange: 'all',
      excludePinned: this.settings.excludePinnedByDefault,
      providerFilter: this.adapter.id,
    });
  }

  /**
   * Main Render Method for Shadow DOM content
   */
  public render(): void {
    const container = this.shadow.getElementById('cs-container') || document.createElement('div');
    container.id = 'cs-container';

    // If progress modal is active, DO NOT destroy or wipe container
    if (this.currentModal === 'progress') {
      if (!this.shadow.contains(container)) {
        this.shadow.appendChild(container);
      }
      // Clean up any lingering confirm modal or non-progress overlay
      container.querySelector('#cs-confirm-modal')?.remove();
      container.querySelectorAll('.cs-modal-overlay:not(#cs-progress-modal)').forEach((el) => el.remove());

      if (this.lastProgress) {
        let progressModal = container.querySelector('#cs-progress-modal');
        if (!progressModal) {
          progressModal = this.createProgressModal(this.lastProgress);
          container.appendChild(progressModal);
        } else {
          this.updateProgressModal(this.lastProgress);
        }
      }
      return;
    }

    // Clear contents of container for normal state transitions
    container.innerHTML = '';

    // 1. Floating Trigger Button
    const trigger = this.createFloatingTrigger();
    container.appendChild(trigger);

    // 2. Action Bar (if selection mode active)
    if (this.isSelectionMode) {
      const actionBar = this.createActionBar();
      container.appendChild(actionBar);
    }

    // 3. Modals
    if (this.currentModal === 'confirm') {
      const confirmModal = this.createConfirmModal();
      container.appendChild(confirmModal);
    }

    if (!this.shadow.contains(container)) {
      this.shadow.appendChild(container);
    }
  }

  /**
   * Floating Trigger Button (Movable, Collapsible, with In-Page Power Toggle)
   */
  private createFloatingTrigger(): HTMLElement {
    const trigger = document.createElement('div');
    trigger.className = `cs-floating-trigger ${this.isSelectionMode ? 'active' : ''} ${this.isCollapsed ? 'collapsed' : ''}`;
    trigger.setAttribute('role', 'region');
    trigger.setAttribute('aria-label', 'ChatSweep Bulk Controls');

    const selectedCount = this.selection.getSelectedCount();
    const countBadgeHtml = selectedCount > 0 ? `<span class="cs-badge">${selectedCount}</span>` : '';

    if (this.isCollapsed) {
      trigger.setAttribute('title', 'ChatSweep (Minimized - click to expand, drag anywhere)');
      trigger.innerHTML = `
        <button class="cs-trigger-action" type="button" aria-label="Expand ChatSweep">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"/>
            <path d="M12 8v4"/>
            <path d="M12 16h.01"/>
          </svg>
          ${countBadgeHtml}
        </button>
      `;
    } else {
      trigger.setAttribute('title', 'ChatSweep: Drag anywhere to move. Click to open bulk tools.');
      trigger.innerHTML = `
        <span class="cs-drag-handle" title="Drag to move anywhere" aria-label="Drag to move">⋮⋮</span>
        <button class="cs-trigger-action" type="button" title="${this.isSelectionMode ? 'Exit Bulk Selection' : 'Open Bulk Selection'}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"/>
            <path d="M12 8v4"/>
            <path d="M12 16h.01"/>
          </svg>
          <span class="cs-trigger-action-text">${this.isSelectionMode ? 'Close Bulk Mode' : 'Bulk Select'}</span>
          ${countBadgeHtml}
        </button>
        <div class="cs-trigger-tools">
          <button class="cs-trigger-tool-btn cs-collapse-btn" type="button" title="Minimize button to small icon" aria-label="Minimize button">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          </button>
          <button class="cs-trigger-tool-btn cs-power-btn" type="button" title="Turn OFF ChatSweep extension (hide all buttons and checkboxes)" aria-label="Turn off extension">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line></svg>
          </button>
        </div>
      `;
    }

    // Smart non-blocking default position (middle right, avoids top navigation and bottom prompt area)
    const defaultX = Math.max(8, window.innerWidth - (this.isCollapsed ? 55 : 185));
    const defaultY = Math.max(80, Math.round(window.innerHeight * 0.42));
    const maxX = Math.max(8, window.innerWidth - (this.isCollapsed ? 50 : 160));
    const maxY = Math.max(8, window.innerHeight - 50);

    const x = this.triggerPos ? Math.max(8, Math.min(this.triggerPos.x, maxX)) : defaultX;
    const y = this.triggerPos ? Math.max(8, Math.min(this.triggerPos.y, maxY)) : defaultY;

    trigger.style.left = `${x}px`;
    trigger.style.top = `${y}px`;
    trigger.style.right = 'auto';
    trigger.style.bottom = 'auto';

    // Tool listeners
    const collapseBtn = trigger.querySelector<HTMLElement>('.cs-collapse-btn');
    if (collapseBtn) {
      collapseBtn.onclick = (e) => {
        e.stopPropagation();
        e.preventDefault();
        this.isCollapsed = true;
        saveUIPositions({ isCollapsed: true });
        this.render();
      };
    }

    const powerBtn = trigger.querySelector<HTMLElement>('.cs-power-btn');
    if (powerBtn) {
      powerBtn.onclick = async (e) => {
        e.stopPropagation();
        e.preventDefault();
        await this.turnOffExtension();
      };
    }

    // Draggable & action click
    this.attachDraggable(
      trigger,
      (newX, newY) => {
        this.triggerPos = { x: newX, y: newY };
        try {
          localStorage.setItem('chatsweep_trigger_pos', JSON.stringify({ x: newX, y: newY }));
        } catch {}
        saveUIPositions({ triggerPos: { x: newX, y: newY } });
      },
      () => {
        if (this.isCollapsed) {
          this.isCollapsed = false;
          saveUIPositions({ isCollapsed: false });
          this.render();
        } else {
          this.toggleSelectionMode();
        }
      },
      {
        excludeSelector: '.cs-trigger-tool-btn',
      }
    );

    return trigger;
  }

  /**
   * Turn OFF extension completely from in-page toggle
   */
  public async turnOffExtension(): Promise<void> {
    try {
      await saveSettings({ extensionEnabled: false });
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({ type: 'SET_EXTENSION_ENABLED', enabled: false }).catch(() => {});
      }
    } catch (e) {
      console.error(e);
    }
    this.showToast('ChatSweep turned OFF. Re-enable anytime from the extension icon in your browser toolbar or press Alt+C.');
    setTimeout(() => {
      this.unmount();
    }, 300);
  }

  /**
   * Sticky Action Bar (Movable, Dockable, and Draggable anywhere)
   */
  private createActionBar(): HTMLElement {
    const bar = document.createElement('div');
    bar.className = 'cs-action-bar';

    const selectedCount = this.selection.getSelectedCount();
    const totalVisible = this.filteredChats.length;

    bar.innerHTML = `
      <div class="cs-bar-title" title="Drag action bar to move anywhere">
        <span class="cs-drag-handle" aria-hidden="true" title="Drag anywhere">⋮⋮</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <span>ChatSweep</span>
        <span class="cs-badge" id="cs-counter-badge">${selectedCount} / ${totalVisible} Selected</span>
        <span class="cs-badge" style="background:#0f172a;color:#38bdf8;border:1px solid #0284c7;font-size:11px;" title="Click any chat to toggle. Hold Shift + Click another chat to select all in that range!">
          ⚡ Shift+Click Range
        </span>
      </div>

      <div class="cs-bar-actions">
        <input 
          type="text" 
          placeholder="Filter titles..." 
          class="cs-search-input" 
          value="${this.searchQuery}" 
          id="cs-search" 
        />
        <button class="cs-btn" id="cs-select-all">Select All</button>
        <button class="cs-btn" id="cs-select-none">None</button>
        <button class="cs-btn" id="cs-invert">Invert</button>
        <button class="cs-btn" id="cs-select-first-5">First 5</button>
        <button class="cs-btn" id="cs-select-first-10">First 10</button>
        <button class="cs-btn" id="cs-load-more" title="Auto-scroll to discover all older conversations">
          Load Full History
        </button>
        <button 
          class="cs-btn cs-btn-danger" 
          id="cs-delete-selected" 
          ${selectedCount === 0 ? 'disabled' : ''}
          title="Bulk delete selected chats"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
          Delete (${selectedCount})
        </button>
        <button class="cs-btn cs-dock-btn" id="cs-dock-toggle" title="Dock action bar to Top or Bottom to avoid blocking chat buttons">
          ${this.actionBarDock === 'top' ? '⬇ Dock Bottom' : '⬆ Dock Top'}
        </button>
        <button class="cs-btn" id="cs-close-mode" title="Close Bulk Mode">
          ✕
        </button>
      </div>
    `;

    // Apply saved action bar position or dock top / bottom
    if (this.actionBarPos) {
      const maxX = Math.max(8, window.innerWidth - 420);
      const maxY = Math.max(8, window.innerHeight - 80);
      const x = Math.max(8, Math.min(this.actionBarPos.x, maxX));
      const y = Math.max(8, Math.min(this.actionBarPos.y, maxY));
      bar.style.left = `${x}px`;
      bar.style.top = `${y}px`;
      bar.style.right = 'auto';
      bar.style.bottom = 'auto';
      bar.style.transform = 'none';
    } else if (this.actionBarDock === 'top') {
      bar.style.top = '20px';
      bar.style.bottom = 'auto';
      bar.style.left = '50%';
      bar.style.transform = 'translateX(-50%)';
    } else {
      bar.style.bottom = '20px';
      bar.style.top = 'auto';
      bar.style.left = '50%';
      bar.style.transform = 'translateX(-50%)';
    }

    // Make the entire action bar draggable (except on input, buttons, links)
    this.attachDraggable(
      bar,
      (x, y) => {
        this.actionBarPos = { x, y };
        this.actionBarDock = 'free';
        try {
          localStorage.setItem('chatsweep_action_bar_pos', JSON.stringify({ x, y }));
          localStorage.setItem('chatsweep_action_bar_dock', 'free');
        } catch {}
        saveUIPositions({ actionBarPos: { x, y }, actionBarDock: 'free' });
      },
      () => {},
      {
        excludeSelector: 'input, button, a',
      }
    );

    // Event listeners
    const searchInput = bar.querySelector<HTMLInputElement>('#cs-search');
    if (searchInput) {
      searchInput.oninput = (e) => {
        this.searchQuery = (e.target as HTMLInputElement).value;
        this.applyFilter();
        this.syncSidebarCheckboxes();
        this.updateActionBarState();
      };
    }

    const selectAllBtn = bar.querySelector<HTMLButtonElement>('#cs-select-all');
    if (selectAllBtn) {
      selectAllBtn.onclick = () => {
        this.selection.selectAll(this.filteredChats);
        this.updateCheckboxesAppearance();
        this.updateActionBarState();
      };
    }

    const selectNoneBtn = bar.querySelector<HTMLButtonElement>('#cs-select-none');
    if (selectNoneBtn) {
      selectNoneBtn.onclick = () => {
        this.selection.deselectAll();
        this.updateCheckboxesAppearance();
        this.updateActionBarState();
      };
    }

    const invertBtn = bar.querySelector<HTMLButtonElement>('#cs-invert');
    if (invertBtn) {
      invertBtn.onclick = () => {
        this.selection.invertSelection(this.filteredChats);
        this.updateCheckboxesAppearance();
        this.updateActionBarState();
      };
    }

    const first5Btn = bar.querySelector<HTMLButtonElement>('#cs-select-first-5');
    if (first5Btn) {
      first5Btn.onclick = () => {
        this.selection.selectFirstN(this.filteredChats, 5);
        this.updateCheckboxesAppearance();
        this.updateActionBarState();
      };
    }

    const first10Btn = bar.querySelector<HTMLButtonElement>('#cs-select-first-10');
    if (first10Btn) {
      first10Btn.onclick = () => {
        this.selection.selectFirstN(this.filteredChats, 10);
        this.updateCheckboxesAppearance();
        this.updateActionBarState();
      };
    }

    const loadMoreBtn = bar.querySelector<HTMLButtonElement>('#cs-load-more');
    if (loadMoreBtn) {
      loadMoreBtn.onclick = async () => {
        loadMoreBtn.textContent = 'Loading...';
        loadMoreBtn.disabled = true;
        try {
          await this.adapter.loadMoreChats((count) => {
            loadMoreBtn.textContent = `Loaded ${count}...`;
          });
          const updated = await this.adapter.getChatList();
          this.setChats(updated);
          this.showToast(`Full history loaded: ${updated.length} chats found.`);
        } finally {
          loadMoreBtn.textContent = 'Load Full History';
          loadMoreBtn.disabled = false;
        }
      };
    }

    const deleteBtn = bar.querySelector<HTMLButtonElement>('#cs-delete-selected');
    if (deleteBtn) {
      deleteBtn.onclick = () => {
        if (this.selection.getSelectedCount() > 0) {
          this.currentModal = 'confirm';
          this.render();
        }
      };
    }

    const dockToggleBtn = bar.querySelector<HTMLButtonElement>('#cs-dock-toggle');
    if (dockToggleBtn) {
      dockToggleBtn.onclick = (e) => {
        e.stopPropagation();
        this.actionBarDock = this.actionBarDock === 'top' ? 'bottom' : 'top';
        this.actionBarPos = null;
        try {
          localStorage.removeItem('chatsweep_action_bar_pos');
          localStorage.setItem('chatsweep_action_bar_dock', this.actionBarDock);
        } catch {}
        saveUIPositions({ actionBarDock: this.actionBarDock, actionBarPos: undefined });
        this.render();
      };
    }

    const closeModeBtn = bar.querySelector<HTMLButtonElement>('#cs-close-mode');
    if (closeModeBtn) {
      closeModeBtn.onclick = (e) => {
        e.stopPropagation();
        this.toggleSelectionMode();
      };
    }

    return bar;
  }

  private updateActionBarState(): void {
    const selectedCount = this.selection.getSelectedCount();
    const totalVisible = this.filteredChats.length;

    // Update counter badge
    const counterBadge = this.shadow.querySelector<HTMLElement>('#cs-counter-badge');
    if (counterBadge) {
      counterBadge.textContent = `${selectedCount} / ${totalVisible} Selected`;
    }

    // Update delete button
    const deleteBtn = this.shadow.querySelector<HTMLButtonElement>('#cs-delete-selected');
    if (deleteBtn) {
      deleteBtn.disabled = selectedCount === 0;
      deleteBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
        Delete (${selectedCount})
      `;
    }

    // Update floating trigger badge
    const triggerBadge = this.shadow.querySelector<HTMLElement>('.cs-floating-trigger .cs-badge');
    const triggerAction = this.shadow.querySelector<HTMLElement>('.cs-floating-trigger .cs-trigger-action') || this.shadow.querySelector<HTMLElement>('.cs-floating-trigger');
    if (triggerAction) {
      if (selectedCount > 0) {
        if (triggerBadge) {
          triggerBadge.textContent = String(selectedCount);
        } else {
          const badge = document.createElement('span');
          badge.className = 'cs-badge';
          badge.textContent = String(selectedCount);
          triggerAction.appendChild(badge);
        }
      } else if (triggerBadge) {
        triggerBadge.remove();
      }
    }
  }

  private updateCheckboxesAppearance(): void {
    const isDark =
      document.documentElement.classList.contains('dark') ||
      document.body.classList.contains('dark') ||
      document.documentElement.getAttribute('data-theme') === 'dark' ||
      window.matchMedia('(prefers-color-scheme: dark)').matches;

    this.chats.forEach((chat) => {
      const el = chat.elementRef;
      if (!el || !document.body.contains(el)) return;

      const btn = el.querySelector<HTMLButtonElement>('.cs-checkbox-btn');
      const isChecked = this.selection.isSelected(chat.id);

      if (btn) {
        btn.setAttribute('aria-checked', isChecked ? 'true' : 'false');
        if (isChecked) {
          btn.classList.add('checked');
          btn.innerHTML = `
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none;display:block;">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          `;
        } else {
          btn.classList.remove('checked');
          btn.innerHTML = '';
        }
      }

      if (isChecked) {
        el.classList.add('cs-row-selected');
        el.style.backgroundColor = isDark ? 'rgba(16, 185, 129, 0.18)' : 'rgba(16, 185, 129, 0.12)';
        el.style.borderLeft = '4px solid #10b981';
        el.style.borderRadius = '6px';
      } else {
        el.classList.remove('cs-row-selected');
        el.style.backgroundColor = '';
        el.style.borderLeft = '';
      }
    });
  }

  /**
   * Confirmation Modal with Safety Checks
   */
  private createConfirmModal(): HTMLElement {
    const overlay = document.createElement('div');
    overlay.className = 'cs-modal-overlay';
    overlay.id = 'cs-confirm-modal';

    const selectedItems = this.selection.getSelectedItems(this.chats);
    const count = selectedItems.length;
    const requiresTextConfirmation =
      this.settings.requireDeleteConfirmationText &&
      count >= this.settings.confirmationTextThreshold;

    const card = document.createElement('div');
    card.className = 'cs-modal-card';
    card.innerHTML = `
      <div class="cs-modal-header">
        <div class="cs-modal-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          Confirm Bulk Deletion (${count} chats)
        </div>
        <button class="cs-btn" id="cs-modal-close" style="padding: 4px 8px;">✕</button>
      </div>

      <div class="cs-warning-box">
        <strong>Warning:</strong> Deletion is irreversible. Once deleted from ${this.adapter.name}, these conversations cannot be restored.
      </div>

      <div style="font-size: 13px; font-weight: 500;">
        Selected conversations to be deleted:
      </div>

      <div class="cs-chat-preview-list">
        ${selectedItems
          .slice(0, 10)
          .map(
            (c) =>
              `<div class="cs-chat-preview-item">📄 ${escapeHtml(c.title)}</div>`
          )
          .join('')}
        ${
          count > 10
            ? `<div style="font-size: 11px; color: var(--cs-text-muted); text-align: center; padding: 4px;">...and ${
                count - 10
              } more</div>`
            : ''
        }
      </div>

      <div style="display: flex; gap: 8px;">
        <button class="cs-btn" id="cs-export-csv" style="flex: 1;">
          📥 Export CSV
        </button>
        <button class="cs-btn" id="cs-export-json" style="flex: 1;">
          📥 Export JSON
        </button>
      </div>

      <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer;">
        <input type="checkbox" id="cs-dry-run-checkbox" ${this.dryRunActive ? 'checked' : ''} />
        <span><strong>Dry-Run Mode:</strong> test execution without actually deleting items</span>
      </label>

      ${
        requiresTextConfirmation
          ? `
        <div>
          <div style="font-size: 12px; margin-bottom: 6px; color: #ef4444; font-weight: 600;">
            To confirm deletion of ${count} chats, type "DELETE" below:
          </div>
          <input type="text" class="cs-confirm-input" id="cs-text-confirm" placeholder="Type DELETE to enable button" />
        </div>
      `
          : ''
      }

      <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px;">
        <button class="cs-btn" id="cs-cancel-delete">Cancel</button>
        <button 
          class="cs-btn cs-btn-danger" 
          id="cs-confirm-delete-btn" 
          ${requiresTextConfirmation ? 'disabled' : ''}
        >
          Confirm & Delete Permanently
        </button>
      </div>
    `;

    // Modal Close
    const closeBtn = card.querySelector<HTMLButtonElement>('#cs-modal-close');
    if (closeBtn) closeBtn.onclick = () => { this.currentModal = 'none'; this.render(); };

    const cancelBtn = card.querySelector<HTMLButtonElement>('#cs-cancel-delete');
    if (cancelBtn) cancelBtn.onclick = () => { this.currentModal = 'none'; this.render(); };

    // Export buttons
    const exportCsvBtn = card.querySelector<HTMLButtonElement>('#cs-export-csv');
    if (exportCsvBtn) {
      exportCsvBtn.onclick = () => {
        const csv = exportChatsToCSV(selectedItems);
        triggerFileDownload(csv, `${this.adapter.id}-chats-${Date.now()}.csv`, 'text/csv');
      };
    }

    const exportJsonBtn = card.querySelector<HTMLButtonElement>('#cs-export-json');
    if (exportJsonBtn) {
      exportJsonBtn.onclick = () => {
        const json = exportChatsToJSON(selectedItems);
        triggerFileDownload(json, `${this.adapter.id}-chats-${Date.now()}.json`, 'application/json');
      };
    }

    // Dry Run Toggle
    const dryRunCheckbox = card.querySelector<HTMLInputElement>('#cs-dry-run-checkbox');
    if (dryRunCheckbox) {
      dryRunCheckbox.onchange = () => {
        this.dryRunActive = dryRunCheckbox.checked;
      };
    }

    // Type DELETE input check
    const confirmBtn = card.querySelector<HTMLButtonElement>('#cs-confirm-delete-btn');
    if (requiresTextConfirmation) {
      const textConfirmInput = card.querySelector<HTMLInputElement>('#cs-text-confirm');
      if (textConfirmInput && confirmBtn) {
        textConfirmInput.oninput = () => {
          confirmBtn.disabled = textConfirmInput.value.trim().toUpperCase() !== 'DELETE';
        };
      }
    }

    // Proceed to deletion
    if (confirmBtn) {
      confirmBtn.onclick = () => {
        this.startDeletionQueue(selectedItems);
      };
    }

    overlay.appendChild(card);
    return overlay;
  }

  /**
   * Progress Modal
   */
  private createProgressModal(progress: QueueProgress): HTMLElement {
    const overlay = document.createElement('div');
    overlay.className = 'cs-modal-overlay';
    overlay.id = 'cs-progress-modal';

    const card = document.createElement('div');
    card.className = 'cs-modal-card';

    const percentage =
      progress.total > 0 ? Math.round((progress.processedCount / progress.total) * 100) : 0;
    const isFinished = ['COMPLETED', 'PARTIAL_FAILURE', 'FAILED', 'CANCELLED'].includes(
      progress.state
    );

    card.innerHTML = `
      <div class="cs-modal-header">
        <div class="cs-modal-title">
          <span>🧹 ChatSweep Deletion Progress</span>
          <span class="cs-badge" id="cs-progress-state-badge">${progress.state}</span>
        </div>
        <button class="cs-btn" id="cs-progress-close" style="padding: 4px 8px; display: ${
          isFinished ? 'block' : 'none'
        };">✕</button>
      </div>

      <div class="cs-progress-track">
        <div class="cs-progress-fill" id="cs-progress-fill" style="width: ${percentage}%;"></div>
      </div>

      <div style="display: flex; justify-content: space-between; font-size: 13px; color: var(--cs-text-muted);">
        <span id="cs-progress-label">${progress.processedCount} of ${progress.total} processed (${percentage}%)</span>
        ${this.dryRunActive ? '<strong style="color: #f59e0b;">DRY-RUN ACTIVE</strong>' : ''}
      </div>

      <div id="cs-progress-current-title" style="background: var(--cs-bg-subtle); padding: 8px 12px; border-radius: 8px; border: 1px solid var(--cs-border); font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: ${
        progress.currentTitle && !isFinished ? 'block' : 'none'
      };">
        Current: <strong>${escapeHtml(progress.currentTitle || '')}</strong>
      </div>

      <div class="cs-stats-grid">
        <div class="cs-stat-card">
          <div class="cs-stat-value" id="cs-stat-deleted" style="color: #10b981;">${progress.successCount}</div>
          <div class="cs-stat-label">Deleted</div>
        </div>
        <div class="cs-stat-card">
          <div class="cs-stat-value" id="cs-stat-failed" style="color: #ef4444;">${progress.failedCount}</div>
          <div class="cs-stat-label">Failed</div>
        </div>
        <div class="cs-stat-card">
          <div class="cs-stat-value" id="cs-stat-skipped" style="color: #f59e0b;">${progress.skippedCount}</div>
          <div class="cs-stat-label">Skipped</div>
        </div>
        <div class="cs-stat-card">
          <div class="cs-stat-value" id="cs-stat-unverified" style="color: #8b5cf6;">${progress.unverifiedCount}</div>
          <div class="cs-stat-label">Unverified</div>
        </div>
      </div>

      <div id="cs-progress-actions" style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px;">
        ${
          !isFinished
            ? `
          <button class="cs-btn" id="cs-pause-btn">
            ${progress.state === 'PAUSED' ? '▶ Resume' : '⏸ Pause'}
          </button>
          <button class="cs-btn cs-btn-danger" id="cs-cancel-btn">
            ⏹ Cancel
          </button>
        `
            : `
          ${
            progress.failedCount > 0
              ? `<button class="cs-btn cs-btn-primary" id="cs-retry-failed-btn">🔄 Retry Failed (${progress.failedCount})</button>`
              : ''
          }
          <button class="cs-btn cs-btn-primary" id="cs-done-btn">Done</button>
        `
        }
      </div>
    `;

    // Progress Controls
    const pauseBtn = card.querySelector<HTMLButtonElement>('#cs-pause-btn');
    if (pauseBtn) {
      pauseBtn.onclick = () => {
        if (progress.state === 'PAUSED') {
          this.queue?.resume();
        } else {
          this.queue?.pause();
        }
      };
    }

    const cancelBtn = card.querySelector<HTMLButtonElement>('#cs-cancel-btn');
    if (cancelBtn) {
      cancelBtn.onclick = () => {
        this.queue?.cancel();
      };
    }

    const retryFailedBtn = card.querySelector<HTMLButtonElement>('#cs-retry-failed-btn');
    if (retryFailedBtn) {
      retryFailedBtn.onclick = () => {
        this.queue?.retryFailed();
      };
    }

    const doneBtn = card.querySelector<HTMLButtonElement>('#cs-done-btn');
    if (doneBtn) {
      doneBtn.onclick = () => {
        this.currentModal = 'none';
        this.selection.deselectAll();
        this.syncSidebarCheckboxes();
        this.render();
      };
    }

    const closeBtn = card.querySelector<HTMLButtonElement>('#cs-progress-close');
    if (closeBtn) {
      closeBtn.onclick = () => {
        this.currentModal = 'none';
        this.selection.deselectAll();
        this.syncSidebarCheckboxes();
        this.render();
      };
    }

    overlay.appendChild(card);
    return overlay;
  }

  private updateProgressModal(progress: QueueProgress): void {
    let overlay = this.shadow.querySelector<HTMLElement>('#cs-progress-modal');
    let fill = this.shadow.querySelector<HTMLElement>('#cs-progress-fill');
    if (!overlay || !fill) {
      const container = this.shadow.getElementById('cs-container');
      if (container) {
        container.querySelectorAll('.cs-modal-overlay').forEach((el) => el.remove());
        overlay = this.createProgressModal(progress);
        container.appendChild(overlay);
        fill = overlay.querySelector<HTMLElement>('#cs-progress-fill');
      }
    }
    if (!fill) return;

    const percentage =
      progress.total > 0 ? Math.round((progress.processedCount / progress.total) * 100) : 0;
    const isFinished = ['COMPLETED', 'PARTIAL_FAILURE', 'FAILED', 'CANCELLED'].includes(
      progress.state
    );

    // Smooth continuous progress bar update (CSS transition handles glide)
    fill.style.width = `${percentage}%`;

    // Update status badge
    const badge = this.shadow.querySelector<HTMLElement>('#cs-progress-state-badge');
    if (badge) badge.textContent = progress.state;

    // Update label
    const label = this.shadow.querySelector<HTMLElement>('#cs-progress-label');
    if (label) {
      label.textContent = `${progress.processedCount} of ${progress.total} processed (${percentage}%)`;
    }

    // Update current title
    const titleBox = this.shadow.querySelector<HTMLElement>('#cs-progress-current-title');
    if (titleBox) {
      if (progress.currentTitle && !isFinished) {
        titleBox.style.display = 'block';
        titleBox.innerHTML = `Current: <strong>${escapeHtml(progress.currentTitle)}</strong>`;
      } else {
        titleBox.style.display = 'none';
      }
    }

    // Update stats counters
    const delEl = this.shadow.querySelector<HTMLElement>('#cs-stat-deleted');
    if (delEl) delEl.textContent = String(progress.successCount);

    const failEl = this.shadow.querySelector<HTMLElement>('#cs-stat-failed');
    if (failEl) failEl.textContent = String(progress.failedCount);

    const skipEl = this.shadow.querySelector<HTMLElement>('#cs-stat-skipped');
    if (skipEl) skipEl.textContent = String(progress.skippedCount);

    const unverEl = this.shadow.querySelector<HTMLElement>('#cs-stat-unverified');
    if (unverEl) unverEl.textContent = String(progress.unverifiedCount);

    // Update pause button text if paused
    const pauseBtn = this.shadow.querySelector<HTMLButtonElement>('#cs-pause-btn');
    if (pauseBtn) {
      pauseBtn.textContent = progress.state === 'PAUSED' ? '▶ Resume' : '⏸ Pause';
    }

    // Update action buttons when finished
    if (isFinished) {
      const actions = this.shadow.querySelector<HTMLElement>('#cs-progress-actions');
      if (actions && !actions.querySelector('#cs-done-btn')) {
        actions.innerHTML = `
          ${
            progress.failedCount > 0
              ? `<button class="cs-btn cs-btn-primary" id="cs-retry-failed-btn">🔄 Retry Failed (${progress.failedCount})</button>`
              : ''
          }
          <button class="cs-btn cs-btn-primary" id="cs-done-btn">Done</button>
        `;
        const retryBtn = actions.querySelector<HTMLButtonElement>('#cs-retry-failed-btn');
        if (retryBtn) retryBtn.onclick = () => this.queue?.retryFailed();

        const doneBtn = actions.querySelector<HTMLButtonElement>('#cs-done-btn');
        if (doneBtn) {
          doneBtn.onclick = () => {
            this.currentModal = 'none';
            this.selection.deselectAll();
            this.syncSidebarCheckboxes();
            this.render();
          };
        }
      }

      const closeBtn = this.shadow.querySelector<HTMLButtonElement>('#cs-progress-close');
      if (closeBtn) {
        closeBtn.style.display = 'block';
        closeBtn.onclick = () => {
          this.currentModal = 'none';
          this.selection.deselectAll();
          this.syncSidebarCheckboxes();
          this.render();
        };
      }
    }
  }

  /**
   * Start Deletion Queue Execution
   */
  private async startDeletionQueue(items: ChatItem[]): Promise<void> {
    // 1. Immediately remove confirm modal overlay so screen transitions cleanly
    this.shadow.querySelector('#cs-confirm-modal')?.remove();
    this.shadow.querySelectorAll('.cs-modal-overlay:not(#cs-progress-modal)').forEach((el) => el.remove());

    this.currentModal = 'progress';
    this.lastProgress = {
      state: 'VALIDATING',
      currentIndex: 0,
      total: items.length,
      processedCount: 0,
      successCount: 0,
      failedCount: 0,
      skippedCount: 0,
      unverifiedCount: 0,
      results: [],
    };
    this.render();

    const queueSettings = {
      ...this.settings,
      minDelayMs: Math.min(this.settings.minDelayMs, 10),
      maxDelayMs: Math.min(this.settings.maxDelayMs, 25),
      dryRunMode: this.dryRunActive,
    };

    this.queue = new DeletionQueue(this.adapter, queueSettings, {
      onProgress: (p) => {
        this.lastProgress = p;
        this.updateProgressModal(p);
      },
      onComplete: async (p) => {
        this.lastProgress = p;
        this.updateProgressModal(p);
        // Refresh sidebar list
        const updated = await this.adapter.getChatList();
        this.setChats(updated);
      },
    });

    this.queue.start(items);
  }

  /**
   * Inject or sync custom checkbox elements inside the host page sidebar
   */
  public syncSidebarCheckboxes(): void {
    if (!this.isSelectionMode) {
      this.removeSidebarCheckboxes();
      return;
    }

    // 1. Ensure host document has CSS styles for injected elements
    this.ensureHostSidebarStyles();

    this.chats.forEach((chat) => {
      // Find element in host document
      let el = chat.elementRef;
      if (!el || !document.body.contains(el)) {
        try {
          el = document.querySelector(`a[href*="${CSS.escape(chat.id)}"]`) as HTMLElement;
        } catch {
          // ignore selector errors
        }
      }
      if (!el) {
        // Fallback search in sidebar
        const anchors = Array.from(
          document.querySelectorAll<HTMLElement>(
            'nav a, a[href*="/chat/"], div[data-testid="chat-item"], li a'
          )
        );
        el = anchors.find((a) => (a.textContent || '').trim().includes(chat.title)) || null;
      }
      if (!el) return;
      chat.elementRef = el;

      // Ensure parent allows flex layout for checkbox alignment
      el.classList.add('cs-has-checkbox');

      // Create or locate the interactive checkbox button
      let btn = el.querySelector<HTMLButtonElement>('.cs-checkbox-btn');
      if (!btn) {
        btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'cs-checkbox-btn';
        btn.setAttribute('role', 'checkbox');
        btn.setAttribute('aria-label', `Select chat: ${chat.title}`);
        btn.setAttribute('data-chat-id', chat.id);
        btn.title = 'Click to select (Shift+Click to select range)';

        // Stop host site from hijacking clicks or drag events
        btn.addEventListener('pointerdown', (e) => e.stopPropagation());
        btn.addEventListener('mousedown', (e) => e.stopPropagation());
        btn.addEventListener('mouseup', (e) => e.stopPropagation());

        // Direct click handler
        btn.addEventListener('click', (e: MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          this.handleChatToggle(chat.id, e.shiftKey);
        });

        // Insert at very beginning of the chat item
        el.insertBefore(btn, el.firstChild);
      }

      // Allow clicking the chat row itself to select during Bulk Mode
      if (!el.hasAttribute('data-cs-click-bound')) {
        el.setAttribute('data-cs-click-bound', 'true');
        el.addEventListener(
          'click',
          (e: MouseEvent) => {
            if (!this.isSelectionMode) return;

            const target = e.target as HTMLElement | null;
            // Checkbox button itself handles its own click
            if (target?.closest('.cs-checkbox-btn')) return;
            // Allow menu buttons (options 3-dots) to work normally
            if (
              target?.closest(
                'button[aria-label*="options" i], button[data-testid*="menu"], button:has(svg)'
              )
            ) {
              return;
            }

            e.preventDefault();
            e.stopPropagation();
            this.handleChatToggle(chat.id, e.shiftKey);
          },
          true
        );
      }
    });

    // Update all visual states immediately
    this.updateCheckboxesAppearance();
  }

  private ensureHostSidebarStyles(): void {
    const STYLE_ID = 'chatsweep-injected-host-styles';
    let styleEl = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = STYLE_ID;
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = `
      .cs-checkbox-btn {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 20px !important;
        height: 20px !important;
        min-width: 20px !important;
        min-height: 20px !important;
        max-width: 20px !important;
        max-height: 20px !important;
        margin-right: 8px !important;
        margin-left: 2px !important;
        padding: 0 !important;
        border-radius: 6px !important;
        cursor: pointer !important;
        position: relative !important;
        z-index: 50 !important;
        flex-shrink: 0 !important;
        box-sizing: border-box !important;
        outline: none !important;
        background-color: rgba(30, 41, 59, 0.85) !important;
        border: 2px solid #64748b !important;
        transition: all 0.15s ease-in-out !important;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25) !important;
        vertical-align: middle !important;
      }
      .cs-checkbox-btn:hover {
        border-color: #10b981 !important;
        box-shadow: 0 0 8px rgba(16, 185, 129, 0.45) !important;
        transform: scale(1.06) !important;
      }
      .cs-checkbox-btn.checked {
        background-color: #10b981 !important;
        border-color: #10b981 !important;
        box-shadow: 0 0 10px rgba(16, 185, 129, 0.5) !important;
      }
      .cs-has-checkbox {
        display: flex !important;
        align-items: center !important;
        overflow: visible !important;
      }
      .cs-row-selected {
        background-color: rgba(16, 185, 129, 0.16) !important;
        border-left: 4px solid #10b981 !important;
        border-radius: 6px !important;
        transition: background-color 0.15s ease !important;
      }
    `;
  }

  public removeSidebarCheckboxes(): void {
    document.querySelectorAll('.cs-checkbox-btn').forEach((btn) => btn.remove());
    document.querySelectorAll('.cs-chat-checkbox-wrapper').forEach((el) => el.remove());
    document.querySelectorAll('.cs-row-selected').forEach((el) => {
      el.classList.remove('cs-row-selected');
      (el as HTMLElement).style.backgroundColor = '';
      (el as HTMLElement).style.borderLeft = '';
    });
    document.querySelectorAll('.cs-has-checkbox').forEach((el) => {
      el.classList.remove('cs-has-checkbox');
    });
    document.querySelectorAll('[data-cs-click-bound]').forEach((el) => {
      el.removeAttribute('data-cs-click-bound');
    });
    const styleEl = document.getElementById('chatsweep-injected-host-styles');
    if (styleEl) styleEl.remove();
  }

  public showToast(message: string, durationMs = 3500): void {
    const toast = document.createElement('div');
    toast.className = 'cs-toast';
    toast.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
        <polyline points="22 4 12 14.01 9 11.01"/>
      </svg>
      <span>${escapeHtml(message)}</span>
    `;

    this.shadow.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, durationMs);
  }

  private repositionElementsOnResize(): void {
    if (this.triggerPos) {
      const btn = this.shadow.querySelector<HTMLElement>('.cs-floating-trigger');
      if (btn) {
        const maxX = Math.max(8, window.innerWidth - btn.offsetWidth - 8);
        const maxY = Math.max(8, window.innerHeight - btn.offsetHeight - 8);
        this.triggerPos.x = Math.max(8, Math.min(this.triggerPos.x, maxX));
        this.triggerPos.y = Math.max(8, Math.min(this.triggerPos.y, maxY));
        btn.style.left = `${this.triggerPos.x}px`;
        btn.style.top = `${this.triggerPos.y}px`;
      }
    }
    if (this.actionBarPos) {
      const bar = this.shadow.querySelector<HTMLElement>('.cs-action-bar');
      if (bar) {
        const maxX = Math.max(8, window.innerWidth - bar.offsetWidth - 8);
        const maxY = Math.max(8, window.innerHeight - bar.offsetHeight - 8);
        this.actionBarPos.x = Math.max(8, Math.min(this.actionBarPos.x, maxX));
        this.actionBarPos.y = Math.max(8, Math.min(this.actionBarPos.y, maxY));
        bar.style.left = `${this.actionBarPos.x}px`;
        bar.style.top = `${this.actionBarPos.y}px`;
      }
    }
  }

  private attachDraggable(
    element: HTMLElement,
    onDragEnd: (x: number, y: number) => void,
    onClick?: () => void,
    options?: {
      handleSelector?: string;
      excludeSelector?: string;
    }
  ): void {
    let isPointerDown = false;
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let initialLeft = 0;
    let initialTop = 0;
    let currentPointerId: number | null = null;
    let suppressClick = false;

    const onPointerDown = (e: PointerEvent) => {
      // Only process primary click
      if (e.button !== 0 && e.pointerType === 'mouse') return;

      const target = e.target as HTMLElement | null;
      if (!target) return;

      if (options?.excludeSelector && target.closest(options.excludeSelector)) {
        return;
      }

      if (options?.handleSelector && !target.closest(options.handleSelector)) {
        return;
      }

      isPointerDown = true;
      isDragging = false;
      suppressClick = false;
      startX = e.clientX;
      startY = e.clientY;
      currentPointerId = e.pointerId;

      const rect = element.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;

      try {
        element.setPointerCapture(e.pointerId);
      } catch {}

      window.addEventListener('pointermove', onPointerMove, { capture: true, passive: false });
      window.addEventListener('pointerup', onPointerUp, { capture: true, passive: false });
      window.addEventListener('pointercancel', onPointerCancel, { capture: true, passive: false });
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isPointerDown) return;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (!isDragging && Math.hypot(dx, dy) >= 4) {
        isDragging = true;
        suppressClick = true;
        element.classList.add('cs-dragging');
      }

      if (isDragging) {
        e.preventDefault();
        e.stopPropagation();

        const maxX = Math.max(8, window.innerWidth - element.offsetWidth - 8);
        const maxY = Math.max(8, window.innerHeight - element.offsetHeight - 8);
        const newLeft = Math.max(8, Math.min(initialLeft + dx, maxX));
        const newTop = Math.max(8, Math.min(initialTop + dy, maxY));

        element.style.left = `${newLeft}px`;
        element.style.top = `${newTop}px`;
        element.style.right = 'auto';
        element.style.bottom = 'auto';
        element.style.transform = 'none';
      }
    };

    const cleanup = () => {
      isPointerDown = false;
      element.classList.remove('cs-dragging');
      window.removeEventListener('pointermove', onPointerMove, true);
      window.removeEventListener('pointerup', onPointerUp, true);
      window.removeEventListener('pointercancel', onPointerCancel, true);
      if (currentPointerId !== null) {
        try {
          element.releasePointerCapture(currentPointerId);
        } catch {}
        currentPointerId = null;
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!isPointerDown) return;

      const wasDragging = isDragging;
      cleanup();

      if (wasDragging) {
        e.preventDefault();
        e.stopPropagation();
        const rect = element.getBoundingClientRect();
        onDragEnd(Math.round(rect.left), Math.round(rect.top));
      } else if (onClick) {
        onClick();
      }
    };

    const onPointerCancel = () => {
      cleanup();
    };

    element.addEventListener('pointerdown', onPointerDown);

    // Prevent accidental click when dragging ended
    element.addEventListener(
      'click',
      (e) => {
        if (suppressClick) {
          e.preventDefault();
          e.stopPropagation();
          suppressClick = false;
        }
      },
      true
    );
  }
}

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
