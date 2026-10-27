# ChatSweep Manual QA & Verification Checklist

Use this checklist to perform regression testing across supported platforms before releasing updates.

---

## General Functional Checks

- [ ] **Extension Loading**: Loads unpacked in Chromium (Chrome, Edge, Brave) with zero manifest errors or warnings.
- [ ] **Popup**:
  - [ ] Shows current platform name when on a supported site.
  - [ ] Displays "Offline / Not on supported site" with quick links when on another domain.
  - [ ] "Toggle Bulk Select in Page" triggers floating action bar in current tab.
  - [ ] "Open Full Dashboard" opens `dashboard.html` in a new tab.
- [ ] **Dashboard (`dashboard.html`)**:
  - [ ] 4 Overview metric cards populate accurately.
  - [ ] Provider grid displays all 9 cards with correct badges (Verified / Experimental).
  - [ ] Manage Chats table supports multi-criteria filtering (search, exclude, dates, provider).
  - [ ] Shift+Click range selection selects consecutive rows.
  - [ ] Export CSV downloads valid comma-separated text file.
  - [ ] Export JSON downloads valid JSON structure.
  - [ ] Dark / Light mode toggle switches visual theme immediately.
- [ ] **Options Page (`options.html`)**:
  - [ ] Changing min/max delay persists on refresh.
  - [ ] Enabling / disabling a platform toggles its active state.
  - [ ] "Reset to Defaults" restores 600–1400ms delay and 3 retries.
  - [ ] "Clear Logs" clears local operational activity logs.

---

## Per-Platform Test Matrix

Test each platform against the following standard scenarios:

### 1. Claude (`claude.ai`) — Verified
- [ ] **Login State**: Detects active session when logged into `claude.ai`.
- [ ] **Discovery**: Floating "Bulk Select" button appears bottom-right.
- [ ] **History Loading**: "Load Full History" button auto-scrolls history until no more chats load.
- [ ] **Single Deletion**: Select 1 chat -> Click Delete -> Modal appears -> Confirm -> Chat removed from sidebar.
- [ ] **Batch Deletion (25 items)**: Select 25 chats -> Type "DELETE" prompt -> Execution runs with jitter -> Counter updates -> 25 verified deleted.
- [ ] **Cancellation Mid-Way**: Start 10 deletions -> Click Cancel at item 3 -> Queue halts immediately -> Partial success recorded.
- [ ] **Dry-Run Mode**: Enable dry-run in options -> Run 5 items -> Simulates deletion without removing real items.
- [ ] **Title Mismatch Safety**: If a chat is deleted outside or re-ordered, adapter skips rather than deleting wrong chat.

### 2. ChatGPT (`chatgpt.com`, `chat.openai.com`) — Verified
- [ ] **Login State**: Detects active session.
- [ ] **Discovery**: Injects checkboxes next to sidebar conversation list items.
- [ ] **History Loading**: Auto-scrolls `nav ol` container.
- [ ] **Single Deletion**: Triggers 3-dot menu -> Clicks Delete -> Confirms red button -> Chat removed.
- [ ] **Batch Deletion**: Deletes multiple items with human delays (600–1400ms).
- [ ] **Cancellation Mid-Way**: Safely cancels and leaves remaining items intact.
- [ ] **CAPTCHA / Challenge**: If Cloudflare challenge appears, queue halts with friendly notification.

### 3. Google Gemini (`gemini.google.com`)
- [ ] **Login State**: Confirms Google account detected.
- [ ] **Discovery**: Matches `div[data-test-id*="conversation-list-item"]`.
- [ ] **Delete Flow**: Clicks 3-dot menu -> Clicks Delete -> Confirms MatDialog Delete button.
- [ ] **Verification**: Confirms item disappeared from DOM.

### 4. Grok (`grok.com`, `x.com/i/grok`)
- [ ] **Discovery**: Detects conversation items in history sidebar.
- [ ] **Delete Flow**: Opens sheet dropdown -> Clicks Delete -> Confirms modal.

### 5. Perplexity (`perplexity.ai`)
- [ ] **Discovery**: Matches library threads.
- [ ] **Delete Flow**: Clicks thread options -> Clicks Delete -> Confirms dialog.

### 6. DeepSeek (`chat.deepseek.com`)
- [ ] **Discovery**: Matches `ds-chat-item` list elements.
- [ ] **Delete Flow**: Clicks menu -> Clicks Delete -> Confirms modal button.

### 7. Microsoft Copilot (`copilot.microsoft.com`)
- [ ] **Discovery**: Matches Copilot history thread elements.
- [ ] **Delete Flow**: Clicks more actions -> Clicks Delete -> Confirms fluent dialog.

### 8. Mistral Le Chat (`chat.mistral.ai`)
- [ ] **Discovery**: Matches conversation rows.
- [ ] **Delete Flow**: Clicks options trigger -> Clicks Delete -> Confirms dialog.

### 9. Poe (`poe.com`)
- [ ] **Discovery**: Matches `ChatHistoryItem` elements.
- [ ] **Delete Flow**: Clicks menu -> Clicks Delete chat -> Confirms modal.

---

## Edge Case Scenarios

- [ ] **Empty History**: Site has 0 conversations -> Shows friendly empty state, no errors.
- [ ] **Duplicate Titles**: Multiple chats with identical names -> Uses unique URLs or ID hashes to distinguish.
- [ ] **Network Disconnect**: Disconnect Wi-Fi during deletion -> Retries 3 times with exponential backoff -> Marks item as failed -> Continues or pauses -> "Retry Failed" re-runs failed items once reconnected.
- [ ] **Rapid SPA Navigation**: Navigating between chats during selection mode does not break UI or crash observer.
