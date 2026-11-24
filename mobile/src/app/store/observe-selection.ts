import { distinctUntilChanged, Observable } from 'rxjs';

interface ObservableStore<S> {
  getState(): S;
  subscribe(listener: () => void): () => void;
}

export function observeSelection<S, T>(store: ObservableStore<S>, selector: (state: S) => T): Observable<T> {
  return new Observable<T>(subscriber => {
    const unsubscribe = store.subscribe(() => subscriber.next(selector(store.getState())));
    subscriber.next(selector(store.getState()));
    return unsubscribe;
  }).pipe(distinctUntilChanged());
}
