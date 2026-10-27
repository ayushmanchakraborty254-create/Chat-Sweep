/**
 * Resilient DOM manipulation and querying utilities
 */

export function queryWithFallbacks<T extends Element = HTMLElement>(
  root: Document | Element,
  selectors: string | string[]
): T | null {
  const selectorList = Array.isArray(selectors) ? selectors : [selectors];
  for (const selector of selectorList) {
    try {
      const el = root.querySelector<T>(selector);
      if (el) return el;
    } catch {
      // Ignore invalid or deprecated selector syntax
    }
  }
  return null;
}

export function queryAllWithFallbacks<T extends Element = HTMLElement>(
  root: Document | Element,
  selectors: string | string[]
): T[] {
  const selectorList = Array.isArray(selectors) ? selectors : [selectors];
  for (const selector of selectorList) {
    try {
      const els = Array.from(root.querySelectorAll<T>(selector));
      if (els.length > 0) return els;
    } catch {
      // Ignore
    }
  }
  return [];
}

/**
 * Wait for an element to appear in the DOM matching selector
 */
export async function waitForElement<T extends HTMLElement = HTMLElement>(
  selector: string | string[],
  root: Document | Element = document,
  timeoutMs = 4000
): Promise<T | null> {
  const existing = queryWithFallbacks<T>(root, selector);
  if (existing) return existing;

  return new Promise((resolve) => {
    let resolved = false;
    const observer = new MutationObserver(() => {
      const el = queryWithFallbacks<T>(root, selector);
      if (el) {
        resolved = true;
        observer.disconnect();
        resolve(el);
      }
    });

    observer.observe(root instanceof Document ? document.body : root, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    setTimeout(() => {
      if (!resolved) {
        observer.disconnect();
        resolve(null);
      }
    }, timeoutMs);
  });
}

/**
 * Wait for an element to disappear from the DOM
 */
export async function waitForElementToDisappear(
  elementOrSelector: Element | string,
  timeoutMs = 4000
): Promise<boolean> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    let exists = false;
    if (typeof elementOrSelector === 'string') {
      exists = !!document.querySelector(elementOrSelector);
    } else {
      exists = document.body.contains(elementOrSelector);
    }
    if (!exists) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}

/**
 * Simulates a realistic human mouse click on an element
 */
export async function triggerHumanClick(element: HTMLElement): Promise<void> {
  element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  await new Promise((r) => setTimeout(r, 80));

  const mouseEvents = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'];
  for (const eventType of mouseEvents) {
    const event = new MouseEvent(eventType, {
      view: window,
      bubbles: true,
      cancelable: true,
      buttons: 1,
    });
    element.dispatchEvent(event);
  }
}

/**
 * Find element containing specific text (case-insensitive)
 */
export function findElementWithText<T extends HTMLElement = HTMLElement>(
  root: Document | Element,
  selector: string,
  targetText: string
): T | null {
  const candidates = Array.from(root.querySelectorAll<T>(selector));
  const normalizedTarget = targetText.trim().toLowerCase();
  for (const el of candidates) {
    const text = (el.textContent || '').trim().toLowerCase();
    if (text === normalizedTarget || text.includes(normalizedTarget)) {
      return el;
    }
  }
  return null;
}
