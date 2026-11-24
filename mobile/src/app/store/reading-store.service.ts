import { Injectable } from '@angular/core';
import { createReadingStore } from './store';
import type { RootState } from './store';
import { observeSelection } from './observe-selection';
import { selectReadingItems } from './reading.selectors';

@Injectable({ providedIn: 'root' })
export class ReadingStoreService {
  readonly store = createReadingStore();
  readonly items$ = this.select(selectReadingItems);

  select<T>(selector: (state: RootState) => T) {
    return observeSelection(this.store, selector);
  }
}
