import { registry } from '../core/registry';
import { getSettings, saveSettings, saveDiscoveredChats } from '../core/storage';
import { ShadowUIManager } from './shadow-ui';

(async function initChatSweepContent() {
  const hostname = window.location.hostname;
  const adapter = registry.getAdapterForHost(hostname);

  if (!adapter) {
    return;
  }

  let currentSettings = await getSettings();

  let uiManager: ShadowUIManager | null = null;
  let unsubscribeObserver: (() => void) | null = null;

  async function initialize() {
    try {
      currentSettings = await getSettings();
    } catch {}

    if (!currentSettings.enabledProviders[adapter!.id] || currentSettings.extensionEnabled === false) {
      if (uiManager) {
        uiManager.unmount();
        uiManager = null;
      }
      if (unsubscribeObserver) {
        unsubscribeObserver();
        unsubscribeObserver = null;
      }
      return;
    }

    if (uiManager) {
      uiManager.unmount();
    }
    if (unsubscribeObserver) {
      unsubscribeObserver();
    }

    uiManager = new ShadowUIManager(adapter!, currentSettings);
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

      if (message.type === 'SET_EXTENSION_ENABLED') {
        const enabled = Boolean(message.enabled);
        if (enabled) {
          initialize();
        } else {
          if (uiManager) {
            uiManager.unmount();
            uiManager = null;
          }
          if (unsubscribeObserver) {
            unsubscribeObserver();
            unsubscribeObserver = null;
          }
        }
        sendResponse({ success: true, enabled });
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

  // Live listener for settings changes
  if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.chatsweep_settings) {
        const newSettings = changes.chatsweep_settings.newValue;
        if (newSettings) {
          if (newSettings.extensionEnabled === false) {
            uiManager?.unmount();
            uiManager = null;
            if (unsubscribeObserver) {
              unsubscribeObserver();
              unsubscribeObserver = null;
            }
          } else if (newSettings.extensionEnabled === true && !uiManager) {
            initialize();
          }
        }
      }
    });
  }

  // Global shortcut (Alt+C) to toggle extension ON/OFF quickly without mouse
  window.addEventListener('keydown', async (e) => {
    if (e.altKey && (e.key === 'c' || e.key === 'C')) {
      e.preventDefault();
      try {
        const settings = await getSettings();
        const nextState = !settings.extensionEnabled;
        await saveSettings({ extensionEnabled: nextState });
        if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
          chrome.runtime.sendMessage({ type: 'SET_EXTENSION_ENABLED', enabled: nextState }).catch(() => {});
        }
        if (nextState) {
          await initialize();
          uiManager?.showToast('ChatSweep turned ON');
        } else {
          if (uiManager) {
            uiManager.showToast('ChatSweep turned OFF');
            setTimeout(() => {
              uiManager?.unmount();
              uiManager = null;
            }, 300);
          }
          if (unsubscribeObserver) {
            unsubscribeObserver();
            unsubscribeObserver = null;
          }
        }
      } catch (err) {
        console.error('[ChatSweep] Error toggling extension via shortcut:', err);
      }
    }
  });

  // Start initialization when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
})();
