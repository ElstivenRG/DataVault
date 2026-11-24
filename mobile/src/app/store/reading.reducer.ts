import { createReducer } from '@reduxjs/toolkit';
import type { Book } from '../models/book';
import { readNow, removeReading } from './reading.actions';

export interface ReadingState { items: Book[]; }
const initialState: ReadingState = { items: [] };

export const readingReducer = createReducer(initialState, builder => {
  builder.addCase(readNow, (state, action) => {
    if (!state.items.some(book => book.id === action.payload.id)) {
      state.items.push(action.payload);
    }
  });
  builder.addCase(removeReading, (state, action) => {
    state.items = state.items.filter(book => book.id !== action.payload);
  });
});
