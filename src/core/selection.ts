import { ChatItem } from '../types';

export class SelectionManager {
  private selectedIds: Set<string> = new Set();
  private lastSelectedId: string | null = null;

  constructor(initialSelected: string[] = []) {
    this.selectedIds = new Set(initialSelected);
  }

  public getSelectedIds(): string[] {
    return Array.from(this.selectedIds);
  }

  public getSelectedCount(): number {
    return this.selectedIds.size;
  }

  public isSelected(id: string): boolean {
    return this.selectedIds.has(id);
  }

  public toggle(id: string, isShiftClick = false, orderedList: ChatItem[] = []): void {
    if (isShiftClick && this.lastSelectedId && orderedList.length > 0) {
      this.rangeSelect(this.lastSelectedId, id, orderedList);
      this.lastSelectedId = id;
      return;
    }

    if (this.selectedIds.has(id)) {
      this.selectedIds.delete(id);
    } else {
      this.selectedIds.add(id);
    }
    this.lastSelectedId = id;
  }

  public setSelected(id: string, selected: boolean): void {
    if (selected) {
      this.selectedIds.add(id);
      this.lastSelectedId = id;
    } else {
      this.selectedIds.delete(id);
    }
  }

  public selectAll(items: ChatItem[]): void {
    items.forEach((item) => this.selectedIds.add(item.id));
  }

  public deselectAll(): void {
    this.selectedIds.clear();
    this.lastSelectedId = null;
  }

  public invertSelection(items: ChatItem[]): void {
    items.forEach((item) => {
      if (this.selectedIds.has(item.id)) {
        this.selectedIds.delete(item.id);
      } else {
        this.selectedIds.add(item.id);
      }
    });
  }

  public selectFirstN(items: ChatItem[], count: number): void {
    this.deselectAll();
    const slice = items.slice(0, count);
    slice.forEach((item) => this.selectedIds.add(item.id));
  }

  /**
   * Shift-click range selection between startId and endId
   */
  public rangeSelect(startId: string, endId: string, orderedList: ChatItem[]): void {
    const startIndex = orderedList.findIndex((item) => item.id === startId);
    const endIndex = orderedList.findIndex((item) => item.id === endId);

    if (startIndex === -1 || endIndex === -1) {
      if (this.selectedIds.has(endId)) {
        this.selectedIds.delete(endId);
      } else {
        this.selectedIds.add(endId);
      }
      return;
    }

    const shouldSelect = this.selectedIds.has(startId);
    const [min, max] = [Math.min(startIndex, endIndex), Math.max(startIndex, endIndex)];
    for (let i = min; i <= max; i++) {
      if (shouldSelect) {
        this.selectedIds.add(orderedList[i].id);
      } else {
        this.selectedIds.delete(orderedList[i].id);
      }
    }
  }

  public getSelectedItems(items: ChatItem[]): ChatItem[] {
    return items.filter((item) => this.selectedIds.has(item.id));
  }
}
