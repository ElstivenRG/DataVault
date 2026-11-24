import { configureStore } from '@reduxjs/toolkit';
import { readingReducer } from './reading.reducer';

export function createReadingStore() {
  return configureStore({
    reducer: { reading: readingReducer },
    devTools: false
  });
}

export type ReadingStore = ReturnType<typeof createReadingStore>;
export type RootState = ReturnType<ReadingStore['getState']>;
export type AppDispatch = ReadingStore['dispatch'];
