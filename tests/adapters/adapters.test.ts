import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { registry } from '../../src/core/registry';
import { ClaudeAdapter } from '../../src/adapters/claude';
import { ChatGPTAdapter } from '../../src/adapters/chatgpt';
import { GeminiAdapter } from '../../src/adapters/gemini';
import { GrokAdapter } from '../../src/adapters/grok';
import { PerplexityAdapter } from '../../src/adapters/perplexity';
import { DeepSeekAdapter } from '../../src/adapters/deepseek';
import { CopilotAdapter } from '../../src/adapters/copilot';
import { MistralAdapter } from '../../src/adapters/mistral';
import { PoeAdapter } from '../../src/adapters/poe';

function loadFixture(filename: string): string {
  const filePath = path.resolve(__dirname, '../fixtures', filename);
  return fs.readFileSync(filePath, 'utf-8');
}

describe('Platform Adapters and DOM Fixtures', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('Registry Host Matching', () => {
    it('matches hostnames to the appropriate adapter', () => {
      expect(registry.getAdapterForHost('claude.ai')?.id).toBe('claude');
      expect(registry.getAdapterForHost('chatgpt.com')?.id).toBe('chatgpt');
      expect(registry.getAdapterForHost('chat.openai.com')?.id).toBe('chatgpt');
      expect(registry.getAdapterForHost('gemini.google.com')?.id).toBe('gemini');
      expect(registry.getAdapterForHost('grok.com')?.id).toBe('grok');
      expect(registry.getAdapterForHost('www.perplexity.ai')?.id).toBe('perplexity');
      expect(registry.getAdapterForHost('chat.deepseek.com')?.id).toBe('deepseek');
      expect(registry.getAdapterForHost('copilot.microsoft.com')?.id).toBe('copilot');
      expect(registry.getAdapterForHost('chat.mistral.ai')?.id).toBe('mistral');
      expect(registry.getAdapterForHost('poe.com')?.id).toBe('poe');
    });

    it('returns null for unsupported domains', () => {
      expect(registry.getAdapterForHost('example.com')).toBeNull();
      expect(registry.getAdapterForHost('google.com')).toBeNull();
    });
  });

  describe('ClaudeAdapter with DOM fixture', () => {
    it('extracts conversation list, titles, and pinned states', async () => {
      document.body.innerHTML = loadFixture('claude-sidebar.html');
      const adapter = new ClaudeAdapter();

      expect(adapter.isLoggedIn()).toBe(true);

      const chats = await adapter.getChatList();
      expect(chats.length).toBe(3);

      expect(chats[0].id).toBe('claude-uuid-1');
      expect(chats[0].title).toBe('Refactoring React Component Tree');
      expect(chats[0].isPinned).toBe(false);

      expect(chats[1].id).toBe('claude-uuid-2');
      expect(chats[1].title).toBe('Python Asyncio Event Loop Debugging');

      const pinnedChat = chats.find((c) => c.id === 'claude-uuid-pinned');
      expect(pinnedChat).toBeDefined();
      expect(pinnedChat?.isPinned).toBe(true);
    });
  });

  describe('ChatGPTAdapter with DOM fixture', () => {
    it('extracts conversation list and IDs accurately', async () => {
      document.body.innerHTML = loadFixture('chatgpt-sidebar.html');
      const adapter = new ChatGPTAdapter();

      expect(adapter.isLoggedIn()).toBe(true);

      const chats = await adapter.getChatList();
      expect(chats.length).toBe(2);
      expect(chats[0].id).toBe('chatgpt-uuid-1');
      expect(chats[0].title).toBe('Next.js SSR Cache Strategy');
      expect(chats[1].id).toBe('chatgpt-uuid-2');
      expect(chats[1].title).toBe('Tailwind CSS Flexbox Alignment');
    });
  });

  describe('GeminiAdapter with DOM fixture', () => {
    it('extracts conversation list and URLs accurately', async () => {
      document.body.innerHTML = loadFixture('gemini-sidebar.html');
      const adapter = new GeminiAdapter();

      expect(adapter.isLoggedIn()).toBe(true);

      const chats = await adapter.getChatList();
      expect(chats.length).toBe(2);
      expect(chats[0].id).toBe('gemini-id-101');
      expect(chats[0].title).toBe('Kubernetes Helm Chart Configuration');
      expect(chats[1].id).toBe('gemini-id-102');
    });
  });

  describe('GrokAdapter with DOM fixture', () => {
    it('extracts Grok conversation item', async () => {
      document.body.innerHTML = loadFixture('grok-sidebar.html');
      const adapter = new GrokAdapter();

      expect(adapter.isLoggedIn()).toBe(true);

      const chats = await adapter.getChatList();
      expect(chats.length).toBe(1);
      expect(chats[0].id).toBe('grok-id-1');
      expect(chats[0].title).toBe('Quantum Computing Superposition');
    });
  });

  describe('PerplexityAdapter with DOM fixture', () => {
    it('extracts Perplexity threads', async () => {
      document.body.innerHTML = loadFixture('perplexity-sidebar.html');
      const adapter = new PerplexityAdapter();

      expect(adapter.isLoggedIn()).toBe(true);

      const chats = await adapter.getChatList();
      expect(chats.length).toBe(1);
      expect(chats[0].id).toBe('pplx-id-1');
      expect(chats[0].title).toBe('Rust Borrow Checker Patterns');
    });
  });

  describe('DeepSeekAdapter with DOM fixture', () => {
    it('extracts DeepSeek conversation items', async () => {
      document.body.innerHTML = loadFixture('deepseek-sidebar.html');
      const adapter = new DeepSeekAdapter();

      expect(adapter.isLoggedIn()).toBe(true);

      const chats = await adapter.getChatList();
      expect(chats.length).toBe(1);
      expect(chats[0].id).toBe('deepseek-id-1');
      expect(chats[0].title).toBe('PostgreSQL Index Optimization');
    });
  });

  describe('CopilotAdapter with DOM fixture', () => {
    it('extracts Copilot threads', async () => {
      document.body.innerHTML = loadFixture('copilot-sidebar.html');
      const adapter = new CopilotAdapter();

      expect(adapter.isLoggedIn()).toBe(true);

      const chats = await adapter.getChatList();
      expect(chats.length).toBe(1);
      expect(chats[0].id).toBe('copilot-id-1');
      expect(chats[0].title).toBe('Azure Cosmos DB Partitioning');
    });
  });

  describe('MistralAdapter with DOM fixture', () => {
    it('extracts Mistral conversations', async () => {
      document.body.innerHTML = loadFixture('mistral-sidebar.html');
      const adapter = new MistralAdapter();

      expect(adapter.isLoggedIn()).toBe(true);

      const chats = await adapter.getChatList();
      expect(chats.length).toBe(1);
      expect(chats[0].id).toBe('mistral-id-1');
      expect(chats[0].title).toBe('Mistral Large Function Calling');
    });
  });

  describe('PoeAdapter with DOM fixture', () => {
    it('extracts Poe conversations', async () => {
      document.body.innerHTML = loadFixture('poe-sidebar.html');
      const adapter = new PoeAdapter();

      expect(adapter.isLoggedIn()).toBe(true);

      const chats = await adapter.getChatList();
      expect(chats.length).toBe(1);
      expect(chats[0].id).toBe('poe-id-1');
      expect(chats[0].title).toBe('Claude 3.5 Sonnet on Poe');
    });
  });

  describe('Empty and broken DOM resilience', () => {
    it('returns empty array when DOM has no history items without throwing', async () => {
      document.body.innerHTML = '<div class="empty-state">No chats found</div>';
      const adapter = new ClaudeAdapter();
      const chats = await adapter.getChatList();
      expect(chats).toEqual([]);
    });
  });
});
