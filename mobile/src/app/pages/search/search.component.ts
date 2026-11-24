import { Component, DestroyRef, inject, NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NativeScriptCommonModule, NativeScriptFormsModule } from '@nativescript/angular';
import { finalize, forkJoin } from 'rxjs';
import type { Book } from '../../models/book';
import { BooksService } from '../../services/books.service';

@Component({
  selector: 'ns-search', standalone: true,
  imports: [NativeScriptCommonModule, NativeScriptFormsModule],
  schemas: [NO_ERRORS_SCHEMA], templateUrl: './search.component.html'
})
export class SearchComponent {
  private readonly api = inject(BooksService);
  private readonly destroyRef = inject(DestroyRef);
  query = '';
  readonly books = signal<Book[]>([]);
  readonly favoriteIds = signal<number[]>([]);
  readonly pendingIds = signal<number[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  readonly searched = signal(false);

  search(): void {
    if (this.loading()) return;
    this.error.set('');
    this.message.set('');
    this.loading.set(true);
    this.searched.set(true);
    forkJoin({ books: this.api.search(this.query), favorites: this.api.favorites() })
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ books, favorites }) => {
          this.books.set(books);
          this.favoriteIds.set(favorites.map(book => book.id));
        },
        error: (error: Error) => {
          this.books.set([]);
          this.error.set(error.message);
        }
      });
  }

  isFavorite(id: number): boolean { return this.favoriteIds().includes(id); }

  saveFavorite(book: Book): void {
    if (this.isFavorite(book.id) || this.pendingIds().includes(book.id)) return;
    this.error.set('');
    this.message.set('');
    this.pendingIds.update(ids => [...ids, book.id]);
    this.api.addFavorite(book.id).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.pendingIds.update(ids => ids.filter(id => id !== book.id)))
    ).subscribe({
      next: () => {
        this.favoriteIds.update(ids => [...ids, book.id]);
        this.message.set(`“${book.title}” guardado en Favoritos.`);
      },
      error: (error: Error) => this.error.set(error.message)
    });
  }
}
