import { describe, it, expect, beforeEach } from 'vitest';
import { getSettings, saveSettings, getUIPositions, saveUIPositions, DEFAULT_SETTINGS } from '../../src/core/storage';

describe('Storage Core Engine', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loads default settings when empty', async () => {
    const settings = await getSettings();
    expect(settings.extensionEnabled).toBe(true);
    expect(settings.minDelayMs).toBe(DEFAULT_SETTINGS.minDelayMs);
  });

  it('updates extensionEnabled when toggled', async () => {
    const updated = await saveSettings({ extensionEnabled: false });
    expect(updated.extensionEnabled).toBe(false);

    const reloaded = await getSettings();
    expect(reloaded.extensionEnabled).toBe(false);

    await saveSettings({ extensionEnabled: true });
    const enabledAgain = await getSettings();
    expect(enabledAgain.extensionEnabled).toBe(true);
  });

  it('saves and retrieves UI positions for movable controls', async () => {
    const initial = await getUIPositions();
    expect(initial.triggerPos).toBeUndefined();

    await saveUIPositions({
      triggerPos: { x: 500, y: 350 },
      actionBarPos: { x: 200, y: 80 },
      isCollapsed: true,
      actionBarDock: 'top',
    });

    const retrieved = await getUIPositions();
    expect(retrieved.triggerPos).toEqual({ x: 500, y: 350 });
    expect(retrieved.actionBarPos).toEqual({ x: 200, y: 80 });
    expect(retrieved.isCollapsed).toBe(true);
    expect(retrieved.actionBarDock).toBe('top');
  });

  it('preserves partial updates when updating UI positions', async () => {
    await saveUIPositions({ triggerPos: { x: 100, y: 200 } });
    await saveUIPositions({ isCollapsed: true });

    const retrieved = await getUIPositions();
    expect(retrieved.triggerPos).toEqual({ x: 100, y: 200 });
    expect(retrieved.isCollapsed).toBe(true);
  });
});
