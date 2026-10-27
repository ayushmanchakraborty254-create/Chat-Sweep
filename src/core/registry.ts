import { PlatformAdapter, ProviderId } from '../types';
import { ClaudeAdapter } from '../adapters/claude';
import { ChatGPTAdapter } from '../adapters/chatgpt';
import { GeminiAdapter } from '../adapters/gemini';
import { GrokAdapter } from '../adapters/grok';
import { PerplexityAdapter } from '../adapters/perplexity';
import { DeepSeekAdapter } from '../adapters/deepseek';
import { CopilotAdapter } from '../adapters/copilot';
import { MistralAdapter } from '../adapters/mistral';
import { PoeAdapter } from '../adapters/poe';

export class AdapterRegistry {
  private static instance: AdapterRegistry;
  private adapters: Map<ProviderId, PlatformAdapter> = new Map();

  private constructor() {
    this.registerDefaultAdapters();
  }

  public static getInstance(): AdapterRegistry {
    if (!AdapterRegistry.instance) {
      AdapterRegistry.instance = new AdapterRegistry();
    }
    return AdapterRegistry.instance;
  }

  private registerDefaultAdapters(): void {
    this.register(new ClaudeAdapter());
    this.register(new ChatGPTAdapter());
    this.register(new GeminiAdapter());
    this.register(new GrokAdapter());
    this.register(new PerplexityAdapter());
    this.register(new DeepSeekAdapter());
    this.register(new CopilotAdapter());
    this.register(new MistralAdapter());
    this.register(new PoeAdapter());
  }

  public register(adapter: PlatformAdapter): void {
    this.adapters.set(adapter.id, adapter);
  }

  public getAdapterById(id: ProviderId): PlatformAdapter | undefined {
    return this.adapters.get(id);
  }

  public getAllAdapters(): PlatformAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * Find matching adapter by hostname (e.g., location.hostname)
   */
  public getAdapterForHost(hostname: string): PlatformAdapter | null {
    const host = hostname.toLowerCase();
    for (const adapter of this.adapters.values()) {
      for (const match of adapter.matches) {
        if (host === match || host.endsWith('.' + match)) {
          return adapter;
        }
      }
    }
    return null;
  }
}

export const registry = AdapterRegistry.getInstance();
