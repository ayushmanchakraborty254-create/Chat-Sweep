import { ChatItem } from '../types';

/**
 * Exports chat metadata to CSV string (titles, dates, URLs, provider only)
 */
export function exportChatsToCSV(chats: ChatItem[]): string {
  const headers = ['ID', 'Provider', 'Title', 'Date', 'URL', 'IsPinned'];
  const rows = chats.map((c) => [
    `"${c.id.replace(/"/g, '""')}"`,
    `"${c.provider}"`,
    `"${c.title.replace(/"/g, '""')}"`,
    `"${(c.date || '').replace(/"/g, '""')}"`,
    `"${(c.url || '').replace(/"/g, '""')}"`,
    c.isPinned ? 'true' : 'false',
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
}

/**
 * Exports chat metadata to JSON string
 */
export function exportChatsToJSON(chats: ChatItem[]): string {
  const safeData = chats.map((c) => ({
    id: c.id,
    provider: c.provider,
    title: c.title,
    date: c.date,
    timestamp: c.timestamp,
    url: c.url,
    isPinned: c.isPinned,
  }));
  return JSON.stringify(safeData, null, 2);
}

/**
 * Triggers a browser download of a generated file in memory
 */
export function triggerFileDownload(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
