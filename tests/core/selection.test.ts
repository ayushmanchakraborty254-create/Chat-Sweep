import { describe, it, expect, beforeEach } from 'vitest';
import { SelectionManager } from '../../src/core/selection';
import { ChatItem } from '../../src/types';

describe('SelectionManager', () => {
  let manager: SelectionManager;
  const mockChats: ChatItem[] = [
    { id: '1', provider: 'claude', title: 'Chat 1' },
    { id: '2', provider: 'claude', title: 'Chat 2' },
    { id: '3', provider: 'claude', title: 'Chat 3' },
    { id: '4', provider: 'claude', title: 'Chat 4' },
    { id: '5', provider: 'claude', title: 'Chat 5' },
  ];

  beforeEach(() => {
    manager = new SelectionManager();
  });

  it('toggles selection of single item', () => {
    manager.toggle('1');
    expect(manager.isSelected('1')).toBe(true);
    expect(manager.getSelectedCount()).toBe(1);

    manager.toggle('1');
    expect(manager.isSelected('1')).toBe(false);
    expect(manager.getSelectedCount()).toBe(0);
  });

  it('selects all items', () => {
    manager.selectAll(mockChats);
    expect(manager.getSelectedCount()).toBe(5);
    expect(manager.isSelected('3')).toBe(true);
  });

  it('deselects all items', () => {
    manager.selectAll(mockChats);
    manager.deselectAll();
    expect(manager.getSelectedCount()).toBe(0);
  });

  it('inverts selection correctly', () => {
    manager.toggle('1');
    manager.toggle('2');
    manager.invertSelection(mockChats);
    expect(manager.isSelected('1')).toBe(false);
    expect(manager.isSelected('2')).toBe(false);
    expect(manager.isSelected('3')).toBe(true);
    expect(manager.isSelected('4')).toBe(true);
    expect(manager.isSelected('5')).toBe(true);
  });

  it('performs shift-click range selection between two items', () => {
    // Click item 2
    manager.toggle('2', false, mockChats);
    expect(manager.getSelectedCount()).toBe(1);

    // Shift-click item 4
    manager.toggle('4', true, mockChats);
    expect(manager.getSelectedCount()).toBe(3);
    expect(manager.isSelected('2')).toBe(true);
    expect(manager.isSelected('3')).toBe(true);
    expect(manager.isSelected('4')).toBe(true);
    expect(manager.isSelected('1')).toBe(false);
    expect(manager.isSelected('5')).toBe(false);
  });

  it('selects first N items', () => {
    manager.selectFirstN(mockChats, 3);
    expect(manager.getSelectedCount()).toBe(3);
    expect(manager.isSelected('1')).toBe(true);
    expect(manager.isSelected('2')).toBe(true);
    expect(manager.isSelected('3')).toBe(true);
    expect(manager.isSelected('4')).toBe(false);
  });
});
