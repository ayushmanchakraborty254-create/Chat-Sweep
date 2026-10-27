# Privacy Policy for ChatSweep

**Last Updated:** October 2026

ChatSweep was created with an uncompromising privacy-first philosophy. Bulk-deleting conversations from your AI assistants should never require trusting a third-party server with your data.

---

## 1. Zero External Data Transmission

- **100% Client-Side Execution:** ChatSweep runs exclusively within your local browser context. 
- **No Remote Servers:** ChatSweep operates without any central server, backend API, cloud database, or tracking infrastructure.
- **Zero Analytics or Telemetry:** ChatSweep contains no analytics trackers, diagnostic telemetry, error trackers (such as Sentry), advertising code, or third-party SDKs.
- **Zero Third-Party Network Requests:** The extension never transmits any data over the network to any host other than the AI chat platforms you explicitly interact with.

---

## 2. Minimal Permissions Architecture

ChatSweep utilizes the principle of least privilege under Manifest V3:

| Permission | Purpose |
| :--- | :--- |
| `storage` | Stores your local user preferences (delay range, confirmation threshold) and local operational audit logs locally on your machine. |
| `host_permissions` | Restricted strictly to the 9 supported AI chat domains (e.g. `claude.ai`, `chatgpt.com`, `gemini.google.com`, etc.) to inject the bulk management toolbar. |

ChatSweep **never** requests:
- Broad access (`<all_urls>` or `http://*/*`)
- Browsing history or active tab tracking (`tabs`)
- Cookie store reading (`cookies`)
- Web request interception (`webRequest`)
- Clipboard reading

---

## 3. How Authentication and Sessions Are Handled

- ChatSweep **never reads, stores, logs, or exports** your passwords, session tokens, bearer headers, or authentication cookies.
- All actions are performed using your existing browser session in the active page via native UI interaction (DOM clicks).

---

## 4. Local Operational Logs

ChatSweep maintains an operational activity log (visible in the Activity Log tab) recording:
- Operation timestamp
- AI platform name
- Conversation title
- Operation status (Deleted, Failed, Skipped, Unverified)
- Error message (if an operation failed)

This log is stored locally in `chrome.storage.local` on your device. You can clear this log at any time with one click in the Settings or Activity Log tab.

---

## 5. Compliance & Terms of Service Notice

Automating web actions may be subject to each individual platform's terms of service. ChatSweep uses realistic human delays (600–1400ms default) with micro-jitter and concurrency of 1 to ensure safe interaction and prevent rate limiting. Users act on their own behalf when managing their conversation histories.

---

## 6. Open Source Verification

ChatSweep is 100% open-source under the MIT license. You can inspect the entire codebase, verify network activity using Chrome DevTools Network Tab, or build the extension from source.
