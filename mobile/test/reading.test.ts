import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createReadingStore } from '../src/app/store/store.ts';
import { readNow, removeReading } from '../src/app/store/reading.actions.ts';
import { selectReadingItems } from '../src/app/store/reading.selectors.ts';
import { observeSelection } from '../src/app/store/observe-selection.ts';

const book = { id: 1, title: 'Un libro', author: 'Autora', description: 'Texto' };

test('dispatch actualiza una seleccion reactiva y evita duplicados', () => {
  const store = createReadingStore();
  const emissions: number[][] = [];
  const subscription = observeSelection(store, selectReadingItems).subscribe(items => {
    emissions.push(items.map(item => item.id));
  });
  store.dispatch(readNow(book));
  store.dispatch(readNow(book));
  assert.equal(selectReadingItems(store.getState()).length, 1);
  store.dispatch(removeReading(1));
  assert.deepEqual(emissions, [[], [1], []]);
  subscription.unsubscribe();
  store.dispatch(readNow(book));
  assert.equal(emissions.length, 3);
});

test('el reducer conserva el estado previo y cada store es independiente', () => {
  const store = createReadingStore();
  const before = store.getState();
  store.dispatch(readNow(book));
  assert.equal(before.reading.items.length, 0);
  assert.equal(createReadingStore().getState().reading.items.length, 0);
});
