import { registry } from '../core/registry';
import { getSettings, saveDiscoveredChats } from '../core/storage';
import { ShadowUIManager } from './shadow-ui';

(async function initChatSweepContent() {
  const hostname = window.location.hostname;
  const adapter = registry.getAdapterForHost(hostname);

  if (!adapter) {
    return;
  }

  const settings = await getSettings();
  if (!settings.enabledProviders[adapter.id]) {
    return;
  }

  let uiManager: ShadowUIManager | null = null;
  let unsubscribeObserver: (() => void) | null = null;

  async function initialize() {
    if (uiManager) {
      uiManager.unmount();
    }
    if (unsubscribeObserver) {
      unsubscribeObserver();
    }

    uiManager = new ShadowUIManager(adapter!, settings);
    uiManager.mount();

    // Initial scan
    try {
      const chats = await adapter!.getChatList();
      uiManager.setChats(chats);
      await saveDiscoveredChats(adapter!.id, chats);

      // If user appears logged in but 0 chats found, might indicate layout change
      if (adapter!.isLoggedIn() && chats.length === 0) {
        setTimeout(async () => {
          const retryChats = await adapter!.getChatList();
          if (retryChats.length === 0) {
            // Friendly error notice without being annoying
            console.warn(
              `[ChatSweep] No conversations detected for ${adapter!.name}. Layout may have updated.`
            );
          } else {
            uiManager?.setChats(retryChats);
            await saveDiscoveredChats(adapter!.id, retryChats);
          }
        }, 2000);
      }
    } catch (e) {
      console.error('[ChatSweep] Error discovering chats:', e);
    }

    // Observe DOM mutations for sidebar changes / pagination with debouncing & diff check
    let mutationDebounceTimer: ReturnType<typeof setTimeout> | null = null;
    let lastChatIdsSignature = '';

    unsubscribeObserver = adapter!.observeChatList(() => {
      if (mutationDebounceTimer) {
        clearTimeout(mutationDebounceTimer);
      }
      mutationDebounceTimer = setTimeout(async () => {
        try {
          const updated = await adapter!.getChatList();
          const currentSignature = updated.map((c) => c.id).join('|');
          if (currentSignature && currentSignature !== lastChatIdsSignature) {
            lastChatIdsSignature = currentSignature;
            uiManager?.setChats(updated);
            await saveDiscoveredChats(adapter!.id, updated);
          }
        } catch (err) {
          console.error('[ChatSweep] Error in observeChatList:', err);
        }
      }, 600);
    });
  }

  // Handle SPA Navigation (client-side routing)
  let lastUrl = location.href;
  const urlCheckInterval = setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      initialize();
    }
  }, 1000);

  window.addEventListener('popstate', () => initialize());

  // Listen for messages from Popup and Dashboard
  if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === 'GET_PAGE_STATUS') {
        adapter!.getChatList().then((chats) => {
          sendResponse({
            success: true,
            providerId: adapter!.id,
            providerName: adapter!.name,
            isConnected: adapter!.isLoggedIn(),
            conversationsDetected: chats.length,
          });
        });
        return true; // async sendResponse
      }

      if (message.type === 'SCAN_CONVERSATIONS') {
        adapter!.getChatList().then((chats) => {
          uiManager?.setChats(chats);
          saveDiscoveredChats(adapter!.id, chats);
          sendResponse({ success: true, count: chats.length, chats });
        });
        return true;
      }

      if (message.type === 'TOGGLE_BULK_MODE') {
        uiManager?.toggleSelectionMode();
        sendResponse({ success: true });
        return true;
      }

      if (message.type === 'LOAD_MORE_CHATS') {
        adapter!.loadMoreChats().then(async (success) => {
          const chats = await adapter!.getChatList();
          uiManager?.setChats(chats);
          sendResponse({ success, count: chats.length });
        });
        return true;
      }

      return false;
    });
  }

  // Start initialization when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
})();
