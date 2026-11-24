import { Component, DestroyRef, inject, NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NativeScriptCommonModule } from '@nativescript/angular';
import { finalize } from 'rxjs';
import type { Book } from '../../models/book';
import { BooksService } from '../../services/books.service';
import { ReadingStoreService } from '../../store/reading-store.service';
import { readNow } from '../../store/reading.actions';

@Component({
  selector: 'ns-favorites', standalone: true,
  imports: [NativeScriptCommonModule], schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './favorites.component.html'
})
export class FavoritesComponent {
  private readonly api = inject(BooksService);
  private readonly reading = inject(ReadingStoreService);
  private readonly destroyRef = inject(DestroyRef);
  readonly books = signal<Book[]>([]);
  readonly loading = signal(false);
  readonly pendingIds = signal<number[]>([]);
  readonly error = signal('');
  readonly message = signal('');

  load(): void {
    if (this.loading() || this.pendingIds().length) return;
    this.loading.set(true);
    this.error.set('');
    this.message.set('');
    this.api.favorites().pipe(
      takeUntilDestroyed(this.destroyRef), finalize(() => this.loading.set(false))
    ).subscribe({
      next: books => this.books.set(books),
      error: (error: Error) => this.error.set(error.message)
    });
  }

  read(book: Book): void {
    // Redux real: el reducer añade el libro; Inicio observa el selector.
    this.reading.store.dispatch(readNow(book));
    this.message.set(`“${book.title}” está en tu lista de Inicio.`);
  }

  remove(book: Book): void {
    if (this.pendingIds().includes(book.id)) return;
    this.error.set('');
    this.message.set('');
    this.pendingIds.update(ids => [...ids, book.id]);
    this.api.removeFavorite(book.id).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.pendingIds.update(ids => ids.filter(id => id !== book.id)))
    ).subscribe({
      next: () => this.books.update(books => books.filter(item => item.id !== book.id)),
      error: (error: Error) => this.error.set(error.message)
    });
  }
}
