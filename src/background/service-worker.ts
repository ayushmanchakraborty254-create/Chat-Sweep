import { getSettings, saveSettings } from '../core/storage';

async function updateExtensionBadge(enabled?: boolean) {
  try {
    const isEnabled = enabled !== undefined ? enabled : (await getSettings()).extensionEnabled !== false;
    if (typeof chrome !== 'undefined' && chrome.action) {
      if (!isEnabled) {
        await chrome.action.setBadgeText({ text: 'OFF' });
        await chrome.action.setBadgeBackgroundColor({ color: '#64748b' });
        await chrome.action.setTitle({ title: 'ChatSweep (Turned OFF - click to enable)' });
      } else {
        await chrome.action.setBadgeText({ text: '' });
        await chrome.action.setTitle({ title: 'ChatSweep - Bulk AI Chat Cleaner' });
      }
    }
  } catch (e) {
    console.error('[ChatSweep] Error updating badge:', e);
  }
}

function broadcastToAllTabs(message: unknown) {
  if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
    chrome.tabs.query({}, (tabs) => {
      for (const tab of tabs) {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, message).catch(() => {
            // Tab might not have content script running
          });
        }
      }
    });
  }
}

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    await getSettings();
    console.log('[ChatSweep] Initialized default settings.');
  }
  await updateExtensionBadge();
});

chrome.runtime.onStartup.addListener(async () => {
  await updateExtensionBadge();
});

// React live to storage changes for settings
if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.chatsweep_settings) {
      const newSettings = changes.chatsweep_settings.newValue;
      if (newSettings && typeof newSettings.extensionEnabled === 'boolean') {
        updateExtensionBadge(newSettings.extensionEnabled);
      }
    }
  });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_SETTINGS') {
    getSettings().then((settings) => sendResponse({ success: true, settings }));
    return true;
  }

  if (message.type === 'SAVE_SETTINGS') {
    saveSettings(message.settings).then((updated) => {
      if (typeof message.settings.extensionEnabled === 'boolean') {
        updateExtensionBadge(message.settings.extensionEnabled);
        broadcastToAllTabs({ type: 'SET_EXTENSION_ENABLED', enabled: message.settings.extensionEnabled });
      }
      sendResponse({ success: true, settings: updated });
    });
    return true;
  }

  if (message.type === 'SET_EXTENSION_ENABLED') {
    const enabled = Boolean(message.enabled);
    saveSettings({ extensionEnabled: enabled }).then((updated) => {
      updateExtensionBadge(enabled);
      broadcastToAllTabs({ type: 'SET_EXTENSION_ENABLED', enabled });
      sendResponse({ success: true, enabled, settings: updated });
    });
    return true;
  }

  if (message.type === 'TOGGLE_EXTENSION') {
    getSettings().then(async (current) => {
      const nextState = !current.extensionEnabled;
      const updated = await saveSettings({ extensionEnabled: nextState });
      await updateExtensionBadge(nextState);
      broadcastToAllTabs({ type: 'SET_EXTENSION_ENABLED', enabled: nextState });
      sendResponse({ success: true, enabled: nextState, settings: updated });
    });
    return true;
  }

  if (message.type === 'OPEN_DASHBOARD') {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
    sendResponse({ success: true });
    return false;
  }

  if (message.type === 'OPEN_OPTIONS') {
    chrome.runtime.openOptionsPage();
    sendResponse({ success: true });
    return false;
  }

  return false;
});
