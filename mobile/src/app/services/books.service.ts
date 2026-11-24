import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { catchError, map, throwError, timeout } from 'rxjs';
import type { Observable } from 'rxjs';
import type { Book, BooksResponse } from '../models/book';
import { ConfigService } from './config.service';

@Injectable({ providedIn: 'root' })
export class BooksService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);
  private readonly headers = new HttpHeaders({ 'ngrok-skip-browser-warning': 'true' });

  search(query: string): Observable<Book[]> {
    return this.request(this.http.get<BooksResponse>(`${this.config.baseUrl}/api/books`, {
      headers: this.headers,
      params: new HttpParams().set('q', query.trim())
    })).pipe(map(response => response.items));
  }

  favorites(): Observable<Book[]> {
    return this.request(this.http.get<BooksResponse>(`${this.config.baseUrl}/api/favorites`, {
      headers: this.headers
    })).pipe(map(response => response.items));
  }

  addFavorite(bookId: number): Observable<Book> {
    return this.request(this.http.post<Book>(`${this.config.baseUrl}/api/favorites`, { bookId }, {
      headers: this.headers
    }));
  }

  removeFavorite(id: number): Observable<void> {
    return this.request(this.http.delete<void>(`${this.config.baseUrl}/api/favorites/${id}`, {
      headers: this.headers
    }));
  }

  private request<T>(source: Observable<T>): Observable<T> {
    return source.pipe(timeout(15000), catchError((error: unknown) => {
      const message = error instanceof HttpErrorResponse && typeof error.error?.message === 'string'
        ? error.error.message
        : 'No se pudo conectar. Revisa la URL de Ngrok en Settings y que Express esté ejecutándose.';
      return throwError(() => new Error(message));
    }));
  }
}
