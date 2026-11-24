import { createAction } from '@reduxjs/toolkit';
import type { Book } from '../models/book';

export const readNow = createAction<Book>('reading/readNow');
export const removeReading = createAction<number>('reading/remove');
