import type { RootState } from './store';

export const selectReadingItems = (state: RootState) => state.reading.items;
export const selectReadingCount = (state: RootState) => state.reading.items.length;
