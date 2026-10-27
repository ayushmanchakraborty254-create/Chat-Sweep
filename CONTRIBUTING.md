# Contributing to ChatSweep

Thank you for your interest in contributing to ChatSweep!

ChatSweep is built to be modular, transparent, and resilient. Our goal is to make managing conversations across AI platforms effortless, safe, and private.

---

## Architecture Principles

1. **Host-Isolated UI**:
   - All in-page UI must be injected into the Shadow DOM (`#chatsweep-shadow-host`).
   - Never inject global CSS into the host document.
2. **Resilient Selectors**:
   - Platform frontends update frequently. Never rely solely on generated or obfuscated class names.
   - Use semantic selectors in order of priority:
     1. `data-testid` / `id`
     2. `aria-label` / `role`
     3. Text content matching (e.g. `findElementWithText`)
     4. Structural fallbacks
3. **Safety First**:
   - Always verify the element's title before triggering a delete action.
   - Always respect concurrency of 1 and randomized human delays.
   - Halt execution if a CAPTCHA or security challenge is detected.
4. **100% Client-Side**:
   - No external APIs, no analytics, no remote dependencies.

---

## Project Structure

```
/src
  /adapters/        // Provider-specific automation logic
  /core/            // Queue, selection, registry, and storage
  /content/         // Injected Shadow DOM components and content script
  /background/      // MV3 service worker
  /dashboard/       // Full-screen React dashboard
  /popup/           // Extension toolbar popup
  /options/         // Extension preferences page
/tests
  /fixtures/        // Saved HTML sidebar snapshots for each platform
  /adapters/        // DOM fixture tests
  /core/            // Queue and logic unit tests
```

---

## Adding a New Platform Adapter

1. Create `src/adapters/<platform>.ts` implementing the `PlatformAdapter` interface.
2. Centralize all selectors in a selectors dictionary at the top of the file with fallbacks.
3. Save an HTML snapshot of the platform's sidebar in `tests/fixtures/<platform>-sidebar.html`.
4. Add a test in `tests/adapters/adapters.test.ts` to verify parsing against the fixture.
5. Register your adapter in `src/core/registry.ts`.
6. Add the domain to `public/manifest.json` under `host_permissions` and `content_scripts.matches`.
7. Run `npm test` and `npm run build` to ensure everything passes cleanly.

---

## Development Workflow

```bash
# Install dependencies
npm install

# Run Vitest unit tests
npm test

# Build production bundle in dist/
npm run build
```

---

## Submitting Pull Requests

- Keep PRs focused on one platform or one feature.
- Ensure all tests pass (`npm test`) and TypeScript compiles without errors (`npm run build`).
- Include test fixtures for any new platform or selector update.
