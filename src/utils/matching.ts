/**
 * Safety and matching verification utilities
 */

/**
 * Normalizes title for loose comparison (whitespace, case, ellipsis)
 */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[…\.\.\.]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Verifies that an element's text content matches the expected title.
 * Used as a critical safety check prior to triggering a deletion action.
 */
export function verifyElementTitleMatch(
  element: HTMLElement,
  expectedTitle: string
): boolean {
  if (!expectedTitle || expectedTitle.toLowerCase() === 'untitled chat') {
    return true; // Untitled chats should proceed with deletion
  }

  // Extract from textContent, aria-label, title, or parent container
  const rawText =
    element.getAttribute('aria-label') ||
    element.getAttribute('title') ||
    element.textContent ||
    element.closest('li, div.group, [data-testid="chat-item"]')?.textContent ||
    '';

  const elText = normalizeTitle(rawText);
  const expText = normalizeTitle(expectedTitle);

  if (!elText) return true; // If DOM element has no extractable text, allow deletion

  // Exact match, startsWith or substring match (for truncated titles)
  return (
    elText === expText ||
    elText.includes(expText) ||
    expText.includes(elText) ||
    elText.startsWith(expText.slice(0, 15)) ||
    expText.startsWith(elText.slice(0, 15))
  );
}

/**
 * Detects if the current webpage has shown a security challenge, CAPTCHA, or logout state
 */
export function detectSecurityChallengeOrLogout(): { isBlocked: boolean; reason?: string } {
  const bodyText = (document.body ? (document.body.innerText || document.body.textContent || '') : '').toLowerCase();

  // CAPTCHA keywords
  if (
    bodyText.includes('cf-challenge') ||
    bodyText.includes('turnstile') ||
    bodyText.includes('verify you are human') ||
    bodyText.includes('security check') ||
    bodyText.includes('enter the characters you see') ||
    document.querySelector('#challenge-running, #cf-turnstile, iframe[src*="recaptcha"], iframe[src*="cloudflare"]')
  ) {
    return { isBlocked: true, reason: 'CAPTCHA or Cloudflare challenge detected.' };
  }

  // Rate limit warning keywords
  if (
    bodyText.includes('too many requests') ||
    bodyText.includes('rate limit exceeded') ||
    bodyText.includes('slow down')
  ) {
    return { isBlocked: true, reason: 'Rate limit (HTTP 429) detected.' };
  }

  return { isBlocked: false };
}
