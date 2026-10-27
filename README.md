# ChatSweep — Universal AI Chat Manager

[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Tests: 31 Passed](https://img.shields.io/badge/Tests-31%20Passed-brightgreen.svg)]()
[![Zero Analytics](https://img.shields.io/badge/Privacy-100%25%20Local-success.svg)]()

> A production-quality, open-source browser extension that empowers users to search, filter, bulk-select, and safely delete conversation histories across 9 major AI chat platforms from a unified, elegant experience.

---

## Supported AI Platforms

| Platform | Domain | Support Status | Method | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Claude** | `claude.ai` | **Verified** | UI Automation | Native dropdown & modal confirmation |
| **ChatGPT** | `chatgpt.com`, `chat.openai.com` | **Verified** | UI Automation | Item menu trigger & modal verification |
| **Google Gemini** | `gemini.google.com` | Verified (Fixture) | UI Automation | Conversation action panel & delete dialog |
| **Grok** | `grok.com`, `x.com/i/grok` | Verified (Fixture) | UI Automation | Dropdown sheet & confirmation prompt |
| **Perplexity** | `perplexity.ai` | Verified (Fixture) | UI Automation | Thread option trigger & confirmation |
| **DeepSeek** | `chat.deepseek.com` | Verified (Fixture) | UI Automation | Sidebar menu item & danger dialog |
| **Microsoft Copilot** | `copilot.microsoft.com` | Verified (Fixture) | UI Automation | Thread menu popover & confirmation |
| **Mistral Le Chat** | `chat.mistral.ai` | Verified (Fixture) | UI Automation | Conversation dropdown & alert dialog |
| **Poe** | `poe.com` | Verified (Fixture) | UI Automation | History item menu & delete modal |

---

## Key Features

- **In-Page Floating Bulk Mode**:
  - Injected via **Shadow DOM** (`<chatsweep-root>`) so host page CSS never conflicts.
  - Custom checkbox badges next to sidebar items with **Shift-Click Range Selection**.
  - Sticky bottom action bar: Select All, Select None, Invert, Search titles, Load full history, and Delete selected.
- **Unified Extension Dashboard**:
  - Full-page dashboard (`dashboard.html`) showing all 9 platform cards with connection status, detected counts, and scan timestamps.
  - Multi-platform chat table with pagination, title search, keyword exclusion, and date range filters (Today, 7 days, 30 days, Older than X days, Custom range).
- **Multi-Layer Safety Engine**:
  - **Pre-Deletion Title Verification**: Verifies the target DOM element's title still matches before clicking delete to prevent off-by-one or re-order mis-clicks.
  - **Type "DELETE" Confirmation**: Required when deleting 10 or more conversations (configurable).
  - **Dry-Run Mode**: Full execution simulation without deleting anything from the server.
  - **Pre-Deletion Metadata Export**: Download selected titles and dates to CSV or JSON before starting deletion.
- **Robust Queue Engine**:
  - Concurrency of 1 to respect platform rate limits.
  - Randomized human-like delay (600–1400 ms default, configurable) with jitter.
  - Bounded exponential backoff on transient errors (max 3 retries).
  - Live progress modal: live counter, pause, resume, cancel, and "Retry Failed" actions.
  - Automatic halt on CAPTCHAs, Cloudflare challenges, or logout states.
- **100% Local & Private**:
  - Zero analytics, telemetry, or remote server calls.
  - Operates purely through the user's active session.
  - Operational activity log stored locally in browser storage.

---

## Installation Guide

### Chrome & Edge (Chromium)

1. Clone or download this repository:
   ```bash
   git clone https://github.com/your-username/chatsweep.git
   cd chatsweep
   ```
2. Install dependencies and build the extension:
   ```bash
   npm install
   npm run build
   ```
3. Open your browser and navigate to the Extensions management page:
   - **Chrome**: `chrome://extensions/`
   - **Edge**: `edge://extensions/`
   - **Brave**: `brave://extensions/`
4. Toggle **Developer mode** in the top-right corner.
5. Click **Load unpacked**.
6. Select the **`dist`** folder inside the `Chat Sweep` directory.
7. ChatSweep is now installed! Pin the extension to your toolbar.

### Firefox

1. Open Firefox and go to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on...**.
3. Select `dist/manifest.json`.

---

## How to Use

1. **In-Page Selection**:
   - Open any supported platform (e.g. `https://claude.ai` or `https://chatgpt.com`).
   - Click the floating **"Bulk Select"** button at the bottom-right corner.
   - Checkboxes will appear on every conversation in the sidebar.
   - Use **Shift + Click** to select a continuous range.
   - Click **"Delete (N)"** on the sticky action bar.
2. **Dashboard**:
   - Click the extension toolbar icon and choose **"Open Full Dashboard"** (or open `dashboard.html`).
   - Overview tab displays live provider statuses and discovered conversation stats.
   - Manage Chats tab lets you filter, sort, and select conversations across providers.
   - Activity Log tab records every operation status (Deleted, Failed, Skipped, Unverified).

---

## Architecture & Codebase Structure

```
/src
  /types                // TypeScript interfaces (ChatItem, PlatformAdapter, Settings, etc.)
  /core
    adapter.ts          // PlatformAdapter interface definition
    registry.ts         // Dynamic hostname-to-adapter resolver
    queue.ts            // State machine deletion queue (concurrency=1, backoff, cancel)
    selection.ts        // Selection manager (select all, invert, shift-click range)
    storage.ts          // chrome.storage.local wrapper (settings, logs, discovery cache)
    export.ts           // Client-side CSV and JSON export utilities
  /adapters
    claude.ts           // Claude.ai adapter
    chatgpt.ts          // ChatGPT adapter
    gemini.ts           // Google Gemini adapter
    grok.ts             // Grok adapter
    perplexity.ts       // Perplexity adapter
    deepseek.ts         // DeepSeek adapter
    copilot.ts          // Microsoft Copilot adapter
    mistral.ts          // Mistral Le Chat adapter
    poe.ts              // Poe adapter
  /content
    content-entry.ts    // Content script entry with SPA navigation handler
    shadow-ui.ts        // In-page Shadow DOM UI manager (action bar, modal, checkboxes)
    styles.css          // Scoped Shadow DOM design system
  /background
    service-worker.ts   // MV3 background service worker
  /dashboard
    Dashboard.tsx       // Full-featured management dashboard
  /popup
    Popup.tsx           // Extension toolbar popup
  /options
    Options.tsx         // Extension options page
  /utils
    dom.ts              // Resilient DOM query helpers and human click simulators
    delays.ts           // Human delay with jitter and exponential backoff
    matching.ts         // Pre-deletion title verification and CAPTCHA detection
    date-filters.ts     // Relative date parsing and filtering
/tests                  // Vitest unit tests and adapter HTML DOM fixtures
```

---

## How to Add a New Platform Adapter

Adding a new platform is straightforward. Create a new file in `src/adapters/` implementing `PlatformAdapter`:

```typescript
// src/adapters/myplatform.ts
import { PlatformAdapter, ProviderId, ChatItem, DeleteResult, AdapterCapabilities } from '../types';
import { queryWithFallbacks, queryAllWithFallbacks, triggerHumanClick, waitForElement } from '../utils/dom';

export const MYPLATFORM_SELECTORS = {
  chatItem: ['a[href*="/chat/"]', 'div[data-testid="chat-item"]'],
  title: ['span.title', 'div.truncate'],
  menuTrigger: ['button[aria-label="Options"]'],
  menuPopup: ['div[role="menu"]'],
  deleteMenuItem: ['[role="menuitem"]:has-text("Delete")'],
  confirmDialog: ['div[role="dialog"]'],
  confirmDeleteButton: ['button:has-text("Delete")'],
  scrollContainer: ['nav', 'div.history-container'],
};

export class MyPlatformAdapter implements PlatformAdapter {
  public readonly id: ProviderId = 'myplatform' as any;
  public readonly name = 'MyPlatform';
  public readonly matches = ['myplatform.ai'];
  public readonly isExperimental = true;
  public readonly capabilities: AdapterCapabilities = {
    bulkSelect: true,
    individualDelete: true,
    nativeBulkDelete: false,
    exportMetadata: true,
    guidedMode: false,
  };
  public readonly selectors = MYPLATFORM_SELECTORS;

  public isLoggedIn(): boolean {
    return !!document.querySelector(MYPLATFORM_SELECTORS.scrollContainer[0]);
  }

  public async getChatList(): Promise<ChatItem[]> {
    // Extract chats from DOM
    return [];
  }

  public observeChatList(callback: () => void): () => void {
    const observer = new MutationObserver(() => callback());
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }

  public async loadMoreChats(): Promise<boolean> {
    // Scroll container
    return true;
  }

  public async deleteChat(chat: ChatItem): Promise<DeleteResult> {
    // Drive site's UI: open menu -> click delete -> confirm
    return { chatId: chat.id, provider: this.id, title: chat.title, success: true, status: 'deleted', timestamp: Date.now() };
  }

  public async verifyDeletion(chat: ChatItem): Promise<boolean> {
    return true;
  }
}
```

Then register it in `src/core/registry.ts`:
```typescript
this.register(new MyPlatformAdapter());
```
Add its domain to `public/manifest.json` under `host_permissions` and `content_scripts.matches`.

---

## Development & Testing

```bash
# Run unit tests and DOM fixture tests
npm test

# Run tests in watch mode
npm run test:watch

# Compile TypeScript and build production bundle
npm run build
```

---

## License

MIT © [ChatSweep Contributors](LICENSE)
