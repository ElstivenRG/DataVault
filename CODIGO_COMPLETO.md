# Proyecto integrador: código completo

Express + SQLite + NativeScript Angular + Redux Toolkit. Cada bloque contiene el archivo íntegro, sin omisiones. Consulta README.md para ejecución y checklist.

## Estructura

```text
backend/
  src/
    app.ts
    repository.ts
    server.ts
  test/
    api.test.ts
    repository.test.ts
  .env.example
  package.json
  tsconfig.json
mobile/
  App_Resources/
    Android/
      src/
        main/
          res/
            values/
              styles.xml
          AndroidManifest.xml
      app.gradle
    iOS/
      build.xcconfig
      Info.plist
  src/
    app/
      models/
        book.ts
      pages/
        favorites/
          favorites.component.html
          favorites.component.ts
        home/
          home.component.html
          home.component.ts
        search/
          search.component.html
          search.component.ts
        settings/
          edit-username.component.html
          edit-username.component.ts
          settings.component.html
          settings.component.ts
      services/
        books.service.ts
        config-validation.ts
        config.service.ts
        profile.service.ts
      store/
        observe-selection.ts
        reading-store.service.ts
        reading.actions.ts
        reading.reducer.ts
        reading.selectors.ts
        store.ts
      app.component.html
      app.component.ts
      app.routes.ts
    environments/
      environment.ts
    app.css
    main.ts
    polyfills.ts
  test/
    config.test.ts
    reading.test.ts
  nativescript.config.ts
  package.json
  references.d.ts
  tsconfig.json
  webpack.config.js
tools/
  check-files.mjs
  export-code.mjs
.gitignore
package.json
README.md
```

## backend/src/app.ts

````typescript
import express from 'express';
import type { ErrorRequestHandler } from 'express';
import type { Repository } from './repository.ts';

export function createApp(repository: Repository) {
  const app = express();
  app.disable('x-powered-by');
  app.set('query parser', 'simple');
  app.use(express.json({ limit: '8kb' }));
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

  app.get('/api/books', (req, res) => {
    const { q, query } = req.query;
    if ((q !== undefined && typeof q !== 'string') ||
        (query !== undefined && typeof query !== 'string')) {
      res.status(400).json({ message: 'q y query deben ser textos únicos.' });
      return;
    }
    const term = (q ?? query ?? '').trim();
    if (term.length > 120) {
      res.status(400).json({ message: 'La búsqueda admite hasta 120 caracteres.' });
      return;
    }
    const items = repository.search(term);
    res.json({ items, total: items.length });
  });

  app.get('/api/favorites', (_req, res) => res.json({ items: repository.favorites() }));
  app.post('/api/favorites', (req, res) => {
    const id: unknown = req.body?.bookId;
    if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0) {
      res.status(400).json({ message: 'bookId debe ser un entero positivo.' });
      return;
    }
    const book = repository.addFavorite(id);
    if (!book) {
      res.status(404).json({ message: 'Libro no encontrado.' });
      return;
    }
    res.status(200).json(book);
  });
  app.delete('/api/favorites/:id', (req, res) => {
    const raw = req.params.id;
    const id = Number(raw);
    if (!/^\d+$/.test(raw) || !Number.isSafeInteger(id) || id <= 0) {
      res.status(400).json({ message: 'Identificador inválido.' });
      return;
    }
    repository.removeFavorite(id);
    res.status(204).end();
  });

  app.use((_req, res) => res.status(404).json({ message: 'Ruta no encontrada.' }));
  const onError: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
    const status = typeof error === 'object' && error !== null && 'status' in error
      ? Number(error.status) : 500;
    if (status === 400 || status === 413) {
      res.status(status).json({ message: status === 413 ? 'Cuerpo demasiado grande.' : 'JSON inválido.' });
      return;
    }
    console.error('Error interno en la API');
    res.status(500).json({ message: 'No se pudo completar la operación.' });
  };
  app.use(onError);
  return app;
}
````

## backend/src/repository.ts

````typescript
import { DatabaseSync } from 'node:sqlite';

export interface Book {
  id: number;
  title: string;
  author: string;
  description: string;
}

const normalize = (value: string) => value.normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

const seed: Omit<Book, 'id'>[] = [
  { title: 'Cien años de soledad', author: 'Gabriel García Márquez', description: 'La historia de la familia Buendía en Macondo.' },
  { title: 'Don Quijote de la Mancha', author: 'Miguel de Cervantes', description: 'Las aventuras de un caballero y su escudero Sancho Panza.' },
  { title: 'El principito', author: 'Antoine de Saint-Exupéry', description: 'Un viaje entre planetas sobre la amistad y lo esencial.' },
  { title: 'Orgullo y prejuicio', author: 'Jane Austen', description: 'Elizabeth Bennet descubre los límites de las primeras impresiones.' },
  { title: 'La metamorfosis', author: 'Franz Kafka', description: 'Gregor Samsa despierta convertido en un extraño insecto.' },
  { title: 'Una habitación propia', author: 'Virginia Woolf', description: 'Un ensayo sobre la independencia y la creación literaria.' }
];

export function openRepository(path: string) {
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS books (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      description TEXT NOT NULL,
      search_text TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS favorites (
      book_id INTEGER PRIMARY KEY REFERENCES books(id) ON DELETE CASCADE
    );
  `);
  const insert = db.prepare(`INSERT OR IGNORE INTO books
    (id, title, author, description, search_text) VALUES (?, ?, ?, ?, ?)`);
  db.exec('BEGIN');
  try {
    seed.forEach((book, index) => insert.run(index + 1, book.title, book.author,
      book.description, normalize(book.title + ' ' + book.author)));
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    db.close();
    throw error;
  }
  const columns = 'id, title, author, description';
  return {
    search(query: string): Book[] {
      return db.prepare(`SELECT ${columns} FROM books
        WHERE instr(search_text, ?) > 0 ORDER BY id`).all(normalize(query)) as unknown as Book[];
    },
    favorites(): Book[] {
      return db.prepare(`SELECT ${columns} FROM books
        JOIN favorites ON favorites.book_id = books.id ORDER BY books.id`).all() as unknown as Book[];
    },
    addFavorite(id: number): Book | undefined {
      const book = db.prepare(`SELECT ${columns} FROM books WHERE id = ?`).get(id) as unknown as Book | undefined;
      if (book) db.prepare('INSERT OR IGNORE INTO favorites (book_id) VALUES (?)').run(id);
      return book;
    },
    removeFavorite(id: number): void {
      db.prepare('DELETE FROM favorites WHERE book_id = ?').run(id);
    },
    close(): void { db.close(); }
  };
}

export type Repository = ReturnType<typeof openRepository>;
````

## backend/src/server.ts

````typescript
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createApp } from './app.ts';
import { openRepository } from './repository.ts';

const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT inválido');
const path = resolve(process.env.DB_PATH ?? './data/biblioteca.sqlite');
mkdirSync(dirname(path), { recursive: true });
const repository = openRepository(path);
const server = createApp(repository).listen(port, process.env.HOST ?? '0.0.0.0', () => {
  console.log(`Biblioteca API escuchando en el puerto ${port}`);
});
server.on('error', error => {
  repository.close();
  console.error(error.message);
  process.exitCode = 1;
});
let closing = false;
function shutdown() {
  if (closing) return;
  closing = true;
  server.close(() => repository.close());
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
````

## backend/test/api.test.ts

````typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../src/app.ts';
import { openRepository } from '../src/repository.ts';

test('API real: filtros, validacion, favoritos y errores JSON', async () => {
  const repo = openRepository(':memory:');
  const server = createApp(repo).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api`;
  const request = (path: string, init?: RequestInit) => fetch(base + path, init);
  try {
    let response = await request('/books?q=GARCIA');
    assert.equal(response.status, 200);
    assert.equal((await response.json()).items[0].id, 1);
    response = await request('/books?query=quijote');
    assert.equal((await response.json()).items[0].id, 2);
    response = await request('/books?q=a&q=b');
    assert.equal(response.status, 400);
    response = await request('/books?q=' + 'x'.repeat(121));
    assert.equal(response.status, 400);
    const post = (body: string) => request('/favorites', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body
    });
    assert.equal((await post('{"bookId":1}')).status, 200);
    assert.equal((await post('{"bookId":1}')).status, 200);
    response = await request('/favorites');
    assert.equal((await response.json()).items.length, 1);
    assert.equal((await post('{"bookId":9999}')).status, 404);
    assert.equal((await post('{"bookId":"1"}')).status, 400);
    response = await post('{');
    assert.equal(response.status, 400);
    assert.equal(typeof (await response.json()).message, 'string');
    assert.equal((await request('/favorites/1', { method: 'DELETE' })).status, 204);
    assert.deepEqual((await (await request('/favorites')).json()).items, []);
    assert.equal((await request('/missing')).status, 404);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    repo.close();
  }
});
````

## backend/test/repository.test.ts

````typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openRepository } from '../src/repository.ts';

test('busca por titulo y autor sin distinguir acentos o mayusculas', () => {
  const repo = openRepository(':memory:');
  try {
    assert.equal(repo.search('GARCIA')[0]?.title, 'Cien años de soledad');
    assert.equal(repo.search('  quijote  ')[0]?.id, 2);
    assert.equal(repo.search('no existe').length, 0);
    assert.ok(repo.search('').length >= 4);
  } finally { repo.close(); }
});

test('trata los comodines SQL y las comillas como texto literal', () => {
  const repo = openRepository(':memory:');
  try {
    assert.deepEqual(repo.search('%'), []);
    assert.deepEqual(repo.search("' OR 1=1 --"), []);
  } finally { repo.close(); }
});

test('guarda sin duplicar, elimina y recupera favoritos tras reabrir SQLite', () => {
  const directory = mkdtempSync(join(tmpdir(), 'biblioteca-'));
  const path = join(directory, 'test.sqlite');
  let repo = openRepository(path);
  try {
    assert.equal(repo.addFavorite(1)?.id, 1);
    repo.addFavorite(1);
    assert.equal(repo.favorites().length, 1);
    assert.equal(repo.addFavorite(9999), undefined);
    repo.close();
    repo = openRepository(path);
    assert.equal(repo.favorites()[0]?.id, 1);
    repo.removeFavorite(1);
    repo.removeFavorite(1);
    assert.deepEqual(repo.favorites(), []);
  } finally {
    repo.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
````

## backend/.env.example

````text
PORT=3000
HOST=0.0.0.0
DB_PATH=./data/biblioteca.sqlite
````

## backend/package.json

````json
{
  "name": "biblioteca-api",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=24.0.0 <25" },
  "scripts": {
    "dev": "node --watch --env-file-if-exists=.env src/server.ts",
    "start": "node --env-file-if-exists=.env src/server.ts",
    "test": "node --test test/*.test.ts",
    "test:db": "node --test test/repository.test.ts",
    "check": "tsc --noEmit"
  },
  "dependencies": { "express": "^5.1.0" },
  "devDependencies": {
    "@types/express": "^5.0.3",
    "@types/node": "^24.0.0",
    "typescript": "~5.8.3"
  }
}
````

## backend/tsconfig.json

````json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "erasableSyntaxOnly": true,
    "types": ["node"],
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts", "test/**/*.ts"]
}
````

## mobile/App_Resources/Android/src/main/res/values/styles.xml

````xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
  <style name="AppTheme" parent="Theme.AppCompat.Light.NoActionBar">
    <item name="colorPrimary">#193e65</item>
    <item name="colorPrimaryDark">#112d4a</item>
    <item name="colorAccent">#193e65</item>
    <item name="android:windowLightStatusBar">false</item>
    <item name="android:statusBarColor">#112d4a</item>
  </style>
</resources>
````

## mobile/App_Resources/Android/src/main/AndroidManifest.xml

````xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="__PACKAGE__">
  <uses-permission android:name="android.permission.INTERNET" />
  <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
  <application android:name="com.tns.NativeScriptApplication"
    android:label="Biblioteca" android:allowBackup="false"
    android:theme="@style/AppTheme" android:usesCleartextTraffic="false">
    <activity android:name="com.tns.NativeScriptActivity"
      android:label="Biblioteca" android:exported="true"
      android:configChanges="keyboardHidden|orientation|screenSize|screenLayout|smallestScreenSize|uiMode"
      android:windowSoftInputMode="adjustResize">
      <intent-filter>
        <action android:name="android.intent.action.MAIN" />
        <category android:name="android.intent.category.LAUNCHER" />
      </intent-filter>
    </activity>
    <activity android:name="com.tns.ErrorReportActivity" android:exported="false" />
  </application>
</manifest>
````

## mobile/App_Resources/Android/app.gradle

````text
android {
  defaultConfig {
    minSdkVersion 23
    targetSdkVersion 35
  }
}
````

## mobile/App_Resources/iOS/build.xcconfig

````text
IPHONEOS_DEPLOYMENT_TARGET = 15.2;
TARGETED_DEVICE_FAMILY = 1,2;
````

## mobile/App_Resources/iOS/Info.plist

````xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDisplayName</key><string>Biblioteca</string>
  <key>CFBundleName</key><string>Biblioteca</string>
  <key>CFBundleIdentifier</key><string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
  <key>CFBundleExecutable</key><string>$(EXECUTABLE_NAME)</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>1.0.0</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>LSRequiresIPhoneOS</key><true/>
  <key>UIDeviceFamily</key><array><integer>1</integer><integer>2</integer></array>
  <key>UILaunchScreen</key><dict/>
  <key>UIRequiresFullScreen</key><true/>
  <key>UISupportedInterfaceOrientations</key>
  <array>
    <string>UIInterfaceOrientationPortrait</string>
    <string>UIInterfaceOrientationLandscapeLeft</string>
    <string>UIInterfaceOrientationLandscapeRight</string>
  </array>
</dict>
</plist>
````

## mobile/src/app/models/book.ts

````typescript
export interface Book {
  id: number;
  title: string;
  author: string;
  description: string;
}

export interface BooksResponse {
  items: Book[];
  total?: number;
}
````

## mobile/src/app/pages/favorites/favorites.component.html

````html
<ActionBar title="Favoritos"></ActionBar>
<GridLayout rows="auto,auto,*" class="screen" (loaded)="load()">
  <StackLayout row="0">
    <Label text="Tus favoritos" class="heading"></Label>
    <Label text="Guardados en SQLite. Usa Leer ahora para enviarlos a Inicio." class="subtitle" textWrap="true"></Label>
    <Button text="Actualizar" (tap)="load()" [isEnabled]="!loading() && pendingIds().length === 0"></Button>
    <Label [text]="error()" [visibility]="error() ? 'visible' : 'collapsed'" class="error" textWrap="true"></Label>
    <Label [text]="message()" [visibility]="message() ? 'visible' : 'collapsed'" class="success" textWrap="true"></Label>
  </StackLayout>
  <ActivityIndicator row="1" [busy]="loading()" [visibility]="loading() ? 'visible' : 'collapsed'"></ActivityIndicator>
  <ScrollView row="2">
    <StackLayout>
      <Label *ngIf="!loading() && !error() && books().length === 0"
        text="Aún no tienes favoritos. Guarda un libro desde Buscar." class="empty" textWrap="true"></Label>
      <StackLayout *ngFor="let book of books()" class="card">
        <Label [text]="book.title" class="title" textWrap="true"></Label>
        <Label [text]="book.author" class="author" textWrap="true"></Label>
        <Label [text]="book.description" class="description" textWrap="true"></Label>
        <Button text="Leer ahora" (tap)="read(book)" class="primary"
          [accessibilityLabel]="'Leer ahora: ' + book.title"></Button>
        <Button text="Quitar de favoritos" (tap)="remove(book)"
          [isEnabled]="!pendingIds().includes(book.id) && !loading()"></Button>
      </StackLayout>
    </StackLayout>
  </ScrollView>
</GridLayout>
````

## mobile/src/app/pages/favorites/favorites.component.ts

````typescript
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
````

## mobile/src/app/pages/home/home.component.html

````html
<ActionBar title="Mi biblioteca"></ActionBar>
<GridLayout rows="auto,*" class="screen">
  <StackLayout row="0">
    <Label [text]="'Hola, ' + profile.username()" class="heading" textWrap="true"></Label>
    <Label text="Lecturas que elegiste con Leer ahora en Favoritos." class="subtitle" textWrap="true"></Label>
  </StackLayout>
  <ScrollView row="1">
    <StackLayout *ngIf="items$ | async as items">
      <Label *ngIf="items.length === 0" text="Tu lista está vacía. Elige un favorito para comenzar."
        class="empty" textWrap="true"></Label>
      <StackLayout *ngFor="let book of items" class="card">
        <Label [text]="book.title" class="title" textWrap="true"></Label>
        <Label [text]="book.author" class="author" textWrap="true"></Label>
        <Label [text]="book.description" class="description" textWrap="true"></Label>
        <Button text="Quitar de mi lista de lectura" (tap)="remove(book.id)"></Button>
      </StackLayout>
    </StackLayout>
  </ScrollView>
</GridLayout>
````

## mobile/src/app/pages/home/home.component.ts

````typescript
import { AsyncPipe } from '@angular/common';
import { Component, inject, NO_ERRORS_SCHEMA } from '@angular/core';
import { NativeScriptCommonModule } from '@nativescript/angular';
import { ProfileService } from '../../services/profile.service';
import { ReadingStoreService } from '../../store/reading-store.service';
import { removeReading } from '../../store/reading.actions';

@Component({
  selector: 'ns-home', standalone: true,
  imports: [NativeScriptCommonModule, AsyncPipe], schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './home.component.html'
})
export class HomeComponent {
  readonly profile = inject(ProfileService);
  private readonly reading = inject(ReadingStoreService);
  readonly items$ = this.reading.items$;

  remove(id: number): void { this.reading.store.dispatch(removeReading(id)); }
}
````

## mobile/src/app/pages/search/search.component.html

````html
<ActionBar title="Buscar libros"></ActionBar>
<GridLayout rows="auto,auto,auto,*" class="screen" (loaded)="search()">
  <StackLayout row="0">
    <Label text="Encuentra tu próxima lectura" class="heading" textWrap="true"></Label>
    <Label text="Busca por título o autor. Vacío muestra todo el catálogo." class="subtitle" textWrap="true"></Label>
    <TextField [(ngModel)]="query" hint="Título o autor" maxLength="120"
      returnKeyType="search" (returnPress)="search()" [isEnabled]="!loading()"
      accessibilityLabel="Título o autor que deseas buscar"></TextField>
    <Button text="Buscar" (tap)="search()" [isEnabled]="!loading()" class="primary"></Button>
  </StackLayout>
  <StackLayout row="1">
    <Label [text]="error()" [visibility]="error() ? 'visible' : 'collapsed'" class="error" textWrap="true"></Label>
    <Label [text]="message()" [visibility]="message() ? 'visible' : 'collapsed'" class="success" textWrap="true"></Label>
  </StackLayout>
  <ActivityIndicator row="2" [busy]="loading()" [visibility]="loading() ? 'visible' : 'collapsed'"></ActivityIndicator>
  <ScrollView row="3">
    <StackLayout>
      <Label *ngIf="searched() && !loading() && !error() && books().length === 0"
        text="No hay resultados para esa búsqueda." class="empty" textWrap="true"></Label>
      <StackLayout *ngFor="let book of books()" class="card">
        <Label [text]="book.title" class="title" textWrap="true"></Label>
        <Label [text]="book.author" class="author" textWrap="true"></Label>
        <Label [text]="book.description" class="description" textWrap="true"></Label>
        <Button [text]="isFavorite(book.id) ? '★ Guardado' : '☆ Guardar favorito'"
          [isEnabled]="!isFavorite(book.id) && !pendingIds().includes(book.id)"
          [accessibilityLabel]="'Guardar ' + book.title + ' como favorito'"
          (tap)="saveFavorite(book)"></Button>
      </StackLayout>
    </StackLayout>
  </ScrollView>
</GridLayout>
````

## mobile/src/app/pages/search/search.component.ts

````typescript
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
````

## mobile/src/app/pages/settings/edit-username.component.html

````html
<ActionBar title="Editar usuario"></ActionBar>
<StackLayout class="screen" (loaded)="load()">
  <Label text="Cómo quieres que te llamemos" class="heading" textWrap="true"></Label>
  <Label text="Entre 2 y 40 caracteres. Se conservará al cerrar la app." class="subtitle" textWrap="true"></Label>
  <TextField [(ngModel)]="username" hint="Nombre de usuario" maxLength="40"
    returnKeyType="done" (returnPress)="save()" accessibilityLabel="Nuevo nombre de usuario"></TextField>
  <Label [text]="error()" [visibility]="error() ? 'visible' : 'collapsed'" class="error" textWrap="true"></Label>
  <Button text="Guardar nombre" (tap)="save()" class="primary"></Button>
  <Button text="Cancelar" nsRouterLink="/settings"></Button>
</StackLayout>
````

## mobile/src/app/pages/settings/edit-username.component.ts

````typescript
import { Component, inject, NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NativeScriptCommonModule, NativeScriptFormsModule, NativeScriptRouterModule } from '@nativescript/angular';
import { ProfileService } from '../../services/profile.service';

@Component({
  selector: 'ns-edit-username', standalone: true,
  imports: [NativeScriptCommonModule, NativeScriptFormsModule, NativeScriptRouterModule],
  schemas: [NO_ERRORS_SCHEMA], templateUrl: './edit-username.component.html'
})
export class EditUsernameComponent {
  private readonly profile = inject(ProfileService);
  private readonly router = inject(Router);
  username = this.profile.username();
  readonly error = signal('');

  load(): void {
    this.profile.reload();
    this.username = this.profile.username();
    this.error.set('');
  }

  save(): void {
    try {
      this.profile.saveUsername(this.username);
      void this.router.navigateByUrl('/settings');
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo guardar el nombre.');
    }
  }
}
````

## mobile/src/app/pages/settings/settings.component.html

````html
<ActionBar title="Settings"></ActionBar>
<ScrollView (loaded)="load()">
  <StackLayout class="screen">
    <Label text="Tu perfil" class="heading"></Label>
    <StackLayout class="card">
      <Label text="Nombre de usuario" class="subtitle"></Label>
      <Label [text]="profile.username()" class="title" textWrap="true"></Label>
      <Button text="Editar nombre de usuario" nsRouterLink="/settings/username" class="primary"></Button>
    </StackLayout>
    <Label text="Conexión al catálogo" class="heading" textWrap="true"></Label>
    <Label text="Copia la dirección HTTPS de Ngrok, sin /api al final." class="subtitle" textWrap="true"></Label>
    <TextField [(ngModel)]="baseUrl" hint="https://tu-dominio.ngrok-free.app"
      autocorrect="false" autocapitalizationType="none" keyboardType="url"
      accessibilityLabel="URL base de Ngrok"></TextField>
    <Button text="Guardar URL" (tap)="saveUrl()" class="primary"></Button>
    <Label [text]="error()" [visibility]="error() ? 'visible' : 'collapsed'" class="error" textWrap="true"></Label>
    <Label [text]="message()" [visibility]="message() ? 'visible' : 'collapsed'" class="success" textWrap="true"></Label>
  </StackLayout>
</ScrollView>
````

## mobile/src/app/pages/settings/settings.component.ts

````typescript
import { Component, inject, NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { NativeScriptCommonModule, NativeScriptFormsModule, NativeScriptRouterModule } from '@nativescript/angular';
import { ProfileService } from '../../services/profile.service';
import { ConfigService } from '../../services/config.service';

@Component({
  selector: 'ns-settings', standalone: true,
  imports: [NativeScriptCommonModule, NativeScriptFormsModule, NativeScriptRouterModule],
  schemas: [NO_ERRORS_SCHEMA], templateUrl: './settings.component.html'
})
export class SettingsComponent {
  readonly profile = inject(ProfileService);
  private readonly config = inject(ConfigService);
  baseUrl = this.config.baseUrl;
  readonly error = signal('');
  readonly message = signal('');

  load(): void {
    this.profile.reload();
    this.baseUrl = this.config.baseUrl;
    this.error.set('');
    this.message.set('');
  }

  saveUrl(): void {
    this.error.set('');
    this.message.set('');
    try {
      this.config.saveBaseUrl(this.baseUrl);
      this.baseUrl = this.config.baseUrl;
      this.message.set('URL guardada. La próxima petición usará esta dirección.');
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo guardar.');
    }
  }
}
````

## mobile/src/app/services/books.service.ts

````typescript
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
````

## mobile/src/app/services/config-validation.ts

````typescript
export function normalizeApiUrl(input: string): string {
  const value = input.trim().replace(/\/+$/, '');
  // Solo origen HTTPS: evita rutas /api duplicadas, credenciales y querystrings.
  if (!/^https:\/\/[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?::\d{1,5})?$/i.test(value)) {
    throw new Error('Usa una URL HTTPS sin rutas, por ejemplo https://tu-dominio.ngrok-free.app');
  }
  const port = value.match(/:(\d+)$/)?.[1];
  if (port && (Number(port) < 1 || Number(port) > 65535)) throw new Error('Puerto inválido.');
  return value;
}

export function normalizeUsername(input: string): string {
  const value = input.trim();
  if (value.length < 2 || value.length > 40) {
    throw new Error('El nombre debe tener entre 2 y 40 caracteres.');
  }
  return value;
}
````

## mobile/src/app/services/config.service.ts

````typescript
import { Injectable } from '@angular/core';
import { ApplicationSettings as AppSettings } from '@nativescript/core';
import { environment } from '../../environments/environment';
import { normalizeApiUrl } from './config-validation';

@Injectable({ providedIn: 'root' })
export class ConfigService {
  get baseUrl(): string {
    return AppSettings.getString('ngrokBaseUrl', environment.ngrokBaseUrl);
  }

  saveBaseUrl(value: string): void {
    AppSettings.setString('ngrokBaseUrl', normalizeApiUrl(value));
  }
}
````

## mobile/src/app/services/profile.service.ts

````typescript
import { Injectable, signal } from '@angular/core';
import { ApplicationSettings as AppSettings } from '@nativescript/core';
import { normalizeUsername } from './config-validation';

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly currentName = signal(AppSettings.getString('username', 'Lector'));
  readonly username = this.currentName.asReadonly();

  reload(): void {
    this.currentName.set(AppSettings.getString('username', 'Lector'));
  }

  saveUsername(value: string): void {
    const name = normalizeUsername(value);
    AppSettings.setString('username', name);
    this.currentName.set(name);
  }
}
````

## mobile/src/app/store/observe-selection.ts

````typescript
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
````

## mobile/src/app/store/reading-store.service.ts

````typescript
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
````

## mobile/src/app/store/reading.actions.ts

````typescript
import { createAction } from '@reduxjs/toolkit';
import type { Book } from '../models/book';

export const readNow = createAction<Book>('reading/readNow');
export const removeReading = createAction<number>('reading/remove');
````

## mobile/src/app/store/reading.reducer.ts

````typescript
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
````

## mobile/src/app/store/reading.selectors.ts

````typescript
import type { RootState } from './store';

export const selectReadingItems = (state: RootState) => state.reading.items;
export const selectReadingCount = (state: RootState) => state.reading.items.length;
````

## mobile/src/app/store/store.ts

````typescript
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
````

## mobile/src/app/app.component.html

````html
<GridLayout rows="*,auto">
  <page-router-outlet row="0"></page-router-outlet>
  <GridLayout row="1" columns="*,*,*,*" class="nav">
    <Button col="0" text="Inicio" nsRouterLink="/home" accessibilityLabel="Ir a inicio"></Button>
    <Button col="1" text="Buscar" nsRouterLink="/search" accessibilityLabel="Buscar libros"></Button>
    <Button col="2" text="Favoritos" nsRouterLink="/favorites" accessibilityLabel="Ver favoritos"></Button>
    <Button col="3" text="Settings" nsRouterLink="/settings" accessibilityLabel="Abrir ajustes"></Button>
  </GridLayout>
</GridLayout>
````

## mobile/src/app/app.component.ts

````typescript
import { Component, NO_ERRORS_SCHEMA } from '@angular/core';
import { NativeScriptCommonModule, NativeScriptRouterModule } from '@nativescript/angular';

@Component({
  selector: 'ns-app',
  standalone: true,
  imports: [NativeScriptCommonModule, NativeScriptRouterModule],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './app.component.html'
})
export class AppComponent {}
````

## mobile/src/app/app.routes.ts

````typescript
import type { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { SearchComponent } from './pages/search/search.component';
import { FavoritesComponent } from './pages/favorites/favorites.component';
import { SettingsComponent } from './pages/settings/settings.component';
import { EditUsernameComponent } from './pages/settings/edit-username.component';

export const routes: Routes = [
  { path: '', redirectTo: '/home', pathMatch: 'full' },
  { path: 'home', component: HomeComponent },
  { path: 'search', component: SearchComponent },
  { path: 'favorites', component: FavoritesComponent },
  { path: 'settings', component: SettingsComponent },
  { path: 'settings/username', component: EditUsernameComponent },
  { path: '**', redirectTo: '/home' }
];
````

## mobile/src/environments/environment.ts

````typescript
export const environment = {
  // Reemplaza por la URL HTTPS que muestra `ngrok http 3000`, sin /api.
  // Settings permite cambiarla y guardarla sin recompilar.
  ngrokBaseUrl: 'https://TU-DOMINIO.ngrok-free.app'
};
````

## mobile/src/app.css

````css
Page { background-color: #f3f5fa; color: #17243d; }
ActionBar { background-color: #193e65; color: white; }
.screen { padding: 16; }
.heading { font-size: 25; font-weight: bold; margin-bottom: 8; }
.subtitle { font-size: 14; color: #506178; margin-bottom: 12; }
.card { background-color: white; border-radius: 12; padding: 14; margin-bottom: 12; }
.title { font-size: 18; font-weight: bold; }
.author { color: #52647c; margin-top: 4; }
.description { margin-top: 8; font-size: 14; }
.primary { background-color: #193e65; color: white; border-radius: 8; }
.error { color: #9f2020; margin: 8 0; }
.success { color: #14613c; margin: 8 0; }
.empty { text-align: center; padding: 20; color: #52647c; }
.nav { background-color: white; border-top-width: 1; border-color: #d4dce8; padding: 4; }
.nav Button { font-size: 11; margin: 1; padding: 4; }
TextField { background-color: white; padding: 12; margin-bottom: 10; border-radius: 8; }
Button { min-height: 44; margin-top: 8; }
````

## mobile/src/main.ts

````typescript
import './polyfills';
import { provideZonelessChangeDetection } from '@angular/core';
import {
  bootstrapApplication,
  provideNativeScriptHttpClient,
  provideNativeScriptRouter,
  runNativeScriptAngularApp
} from '@nativescript/angular';
import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';

runNativeScriptAngularApp({
  appModuleBootstrap: () => bootstrapApplication(AppComponent, {
    providers: [
      provideZonelessChangeDetection(),
      provideNativeScriptHttpClient(),
      provideNativeScriptRouter(routes)
    ]
  })
});
````

## mobile/src/polyfills.ts

````typescript
import '@nativescript/core/globals';
import '@nativescript/angular/polyfills';
````

## mobile/test/config.test.ts

````typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeApiUrl, normalizeUsername } from '../src/app/services/config-validation.ts';

test('normaliza URL Ngrok y rechaza rutas, credenciales y puertos invalidos', () => {
  assert.equal(normalizeApiUrl(' https://ejemplo.ngrok-free.app/// '), 'https://ejemplo.ngrok-free.app');
  for (const value of ['http://ejemplo.com', 'https://host/api', 'https://user:pass@host', 'https://host?q=a', 'https://host:99999']) {
    assert.throws(() => normalizeApiUrl(value));
  }
});

test('valida y recorta el nombre antes de persistirlo', () => {
  assert.equal(normalizeUsername('  Ana  '), 'Ana');
  assert.throws(() => normalizeUsername(' '));
  assert.throws(() => normalizeUsername('a'.repeat(41)));
});
````

## mobile/test/reading.test.ts

````typescript
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
````

## mobile/nativescript.config.ts

````typescript
import type { NativeScriptConfig } from '@nativescript/core';

export default {
  id: 'org.modulo3.biblioteca',
  appPath: 'src',
  appResourcesPath: 'App_Resources',
  android: { v8Flags: '--expose_gc', markingMode: 'none' }
} satisfies NativeScriptConfig;
````

## mobile/package.json

````json
{
  "name": "biblioteca-mobile",
  "version": "1.0.0",
  "private": true,
  "main": "src/main.ts",
  "engines": { "node": ">=24.0.0 <25" },
  "scripts": {
    "android": "ns run android",
    "ios": "ns run ios",
    "check": "ngc --noEmit",
    "test": "node --import tsx --test test/*.test.ts",
    "test:config": "node --test test/config.test.ts"
  },
  "dependencies": {
    "@angular/animations": "~20.2.0",
    "@angular/common": "~20.2.0",
    "@angular/compiler": "~20.2.0",
    "@angular/core": "~20.2.0",
    "@angular/forms": "~20.2.0",
    "@angular/platform-browser": "~20.2.0",
    "@angular/platform-browser-dynamic": "~20.2.0",
    "@angular/router": "~20.2.0",
    "@nativescript/angular": "^20.0.0",
    "@nativescript/core": "~9.0.0",
    "@reduxjs/toolkit": "^2.8.2",
    "rxjs": "~7.8.0",
    "zone.js": "~0.15.0"
  },
  "devDependencies": {
    "@angular-devkit/build-angular": "~20.2.0",
    "@angular/compiler-cli": "~20.2.0",
    "@nativescript/android": "~9.0.0",
    "@nativescript/ios": "~9.0.0",
    "@nativescript/types": "~9.0.0",
    "@nativescript/webpack": "~5.0.25",
    "@ngtools/webpack": "~20.2.0",
    "nativescript": "~9.0.0",
    "tsx": "^4.20.0",
    "typescript": "~5.8.3"
  }
}
````

## mobile/references.d.ts

````typescript
/// <reference path="./node_modules/@nativescript/types/index.d.ts" />
````

## mobile/tsconfig.json

````json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "skipLibCheck": true,
    "lib": ["ESNext", "DOM"],
    "baseUrl": ".",
    "paths": { "~/*": ["src/*"] }
  },
  "angularCompilerOptions": { "strictTemplates": true },
  "files": ["src/main.ts", "references.d.ts"],
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "platforms", "test"]
}
````

## mobile/webpack.config.js

````javascript
const webpack = require('@nativescript/webpack');

module.exports = (env) => {
  webpack.init(env);
  return webpack.resolveConfig();
};
````

## tools/check-files.mjs

````javascript
import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const excluded = new Set(['node_modules', '.npm-cache', '.git', 'platforms', 'hooks', 'dist', 'data', '.nsbuild']);
let count = 0;
async function exists(path) {
  try { return (await stat(path)).isFile(); } catch { return false; }
}
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (excluded.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) { await walk(path); continue; }
    if (entry.name === 'CODIGO_COMPLETO.md') continue;
    const source = await readFile(path, 'utf8');
    if (extname(path) === '.json') JSON.parse(source);
    if (['.ts', '.js', '.mjs'].includes(extname(path))) {
      for (const match of source.matchAll(/(?:from\s+|import\s*)['"](\.[^'"]+)['"]/g)) {
        const target = resolve(dirname(path), match[1]);
        assert.ok(await exists(target) || await exists(target + '.ts') || await exists(target + '.js'),
          `Import no encontrado en ${path}: ${match[1]}`);
      }
      for (const match of source.matchAll(/templateUrl:\s*['"]([^'"]+)['"]/g)) {
        assert.ok(await exists(resolve(dirname(path), match[1])), `Template no encontrado: ${path}`);
      }
    }
    count++;
  }
}
await walk(root);
console.log(`${count} archivos revisados: JSON, imports relativos y templates existentes.`);
````

## tools/export-code.mjs

````javascript
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join, relative, resolve, sep } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const excluded = new Set(['node_modules', '.npm-cache', '.git', 'platforms', 'hooks', 'dist', 'data', '.nsbuild']);
const omitted = new Set(['CODIGO_COMPLETO.md', '.env', 'package-lock.json']);
const languages = { '.ts': 'typescript', '.js': 'javascript', '.mjs': 'javascript', '.json': 'json', '.html': 'html', '.xml': 'xml', '.plist': 'xml', '.css': 'css', '.md': 'markdown' };
const paths = [];
const tree = [];
async function walk(directory, depth = 0) {
  const entries = (await readdir(directory, { withFileTypes: true }))
    .filter(entry => !excluded.has(entry.name) && !omitted.has(entry.name))
    .sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name));
  for (const entry of entries) {
    const path = join(directory, entry.name);
    tree.push('  '.repeat(depth) + entry.name + (entry.isDirectory() ? '/' : ''));
    if (entry.isDirectory()) await walk(path, depth + 1);
    else paths.push(path);
  }
}
await walk(root);
const sections = ['# Proyecto integrador: código completo',
  'Express + SQLite + NativeScript Angular + Redux Toolkit. Cada bloque contiene el archivo íntegro, sin omisiones. Consulta README.md para ejecución y checklist.',
  '## Estructura', '```text\n' + tree.join('\n') + '\n```'];
for (const path of paths) {
  const name = relative(root, path).split(sep).join('/');
  const source = await readFile(path, 'utf8');
  sections.push('## ' + name, '````' + (languages[extname(path)] ?? 'text') + '\n' + source.trimEnd() + '\n````');
}
await writeFile(join(root, 'CODIGO_COMPLETO.md'), sections.join('\n\n') + '\n');
console.log(`CODIGO_COMPLETO.md generado con ${paths.length} archivos completos.`);
````

## .gitignore

````text
node_modules/
.npm-cache/
platforms/
hooks/
dist/
.env
*.sqlite
*.sqlite-shm
*.sqlite-wal
backend/data/
mobile/.nsbuild/
````

## package.json

````json
{
  "name": "biblioteca-modulo-3",
  "private": true,
  "scripts": {
    "install:all": "npm install --prefix backend && npm install --prefix mobile",
    "test": "npm test --prefix backend && npm test --prefix mobile",
    "check": "npm run check --prefix backend && npm run check --prefix mobile",
    "check:files": "node tools/check-files.mjs",
    "docs": "node tools/export-code.mjs"
  }
}
````

## README.md

````markdown
# Biblioteca — proyecto integrador del Módulo 3

Aplicación móvil con **NativeScript 9, Angular 20.2 y Redux Toolkit 2**, más una API **Express 5 en TypeScript** con persistencia real en **SQLite**. El código está en `backend/` y `mobile/`. `CODIGO_COMPLETO.md` reúne la estructura detallada y el contenido íntegro de cada archivo entregado.

## Flujo de uso y persistencia

1. En **Settings**, guarda la URL HTTPS de Ngrok y entra a **Editar nombre de usuario**.
2. En **Buscar**, escribe un título o autor y pulsa **Buscar**, o usa la tecla de búsqueda del teclado. Una consulta vacía lista todo el catálogo. La búsqueda no distingue mayúsculas ni acentos.
3. Pulsa **☆ Guardar favorito** en un resultado. La estrella cambia a **★ Guardado** después de confirmar la escritura en SQLite.
4. Abre **Favoritos** y pulsa **Leer ahora**. El componente despacha `readNow(book)` al Store de Redux.
5. Abre **Inicio**: `selectReadingItems` y `AsyncPipe` muestran la lista reactiva. Los duplicados se ignoran. Puedes quitar un libro de esta lista sin borrar su favorito.

| Dato | Ubicación | Sobrevive a un reinicio |
|---|---|---|
| Catálogo y favoritos | `backend/data/biblioteca.sqlite` | Sí, mientras se conserve el archivo |
| Nombre de usuario | `AppSettings`, clave `username` | Sí, al cerrar y abrir la app |
| URL de Ngrok | `AppSettings`, clave `ngrokBaseUrl` | Sí |
| Lista “Leer ahora” | Store Redux en memoria | No; no se exige persistencia para esa lista |

El nombre es una preferencia local, no una cuenta de autenticación. Los favoritos pertenecen a un catálogo compartido de demostración. Borrar los datos o desinstalar la app elimina sus preferencias locales. No se incluyen textos completos de los libros: “Leer ahora” envía el elemento a la lista de Inicio, como exige el enunciado.

## Estructura principal

```text
Modulo 3/
├── backend/
│   ├── .env.example
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── server.ts             # Puerto, archivo SQLite y arranque
│   │   ├── app.ts                # Rutas Express y validación HTTP
│   │   └── repository.ts         # Esquema, catálogo y consultas SQLite
│   └── test/
│       ├── api.test.ts
│       └── repository.test.ts
├── mobile/
│   ├── App_Resources/            # Manifest/tema Android y configuración iOS
│   ├── nativescript.config.ts
│   ├── package.json
│   ├── references.d.ts
│   ├── tsconfig.json
│   ├── webpack.config.js
│   ├── src/
│   │   ├── main.ts
│   │   ├── polyfills.ts
│   │   ├── app.css
│   │   ├── environments/environment.ts
│   │   └── app/
│   │       ├── app.component.ts / .html
│   │       ├── app.routes.ts
│   │       ├── models/book.ts
│   │       ├── services/
│   │       │   ├── books.service.ts
│   │       │   ├── config.service.ts
│   │       │   ├── config-validation.ts
│   │       │   └── profile.service.ts
│   │       ├── store/
│   │       │   ├── reading.actions.ts
│   │       │   ├── reading.reducer.ts
│   │       │   ├── reading.selectors.ts
│   │       │   ├── store.ts
│   │       │   ├── observe-selection.ts
│   │       │   └── reading-store.service.ts
│   │       └── pages/
│   │           ├── home/home.component.ts / .html
│   │           ├── search/search.component.ts / .html
│   │           ├── favorites/favorites.component.ts / .html
│   │           └── settings/
│   │               ├── settings.component.ts / .html
│   │               └── edit-username.component.ts / .html
│   └── test/
│       ├── config.test.ts
│       └── reading.test.ts
├── tools/
│   ├── check-files.mjs
│   └── export-code.mjs
├── package.json
└── CODIGO_COMPLETO.md
```

## Instalación y ejecución

Requiere **Node.js 24.x**, npm y conexión al registro npm para instalar las dependencias. El backend ejecuta TypeScript directamente mediante el soporte de Node 24 y utiliza `node:sqlite`; no requiere instalar un servidor de base de datos. Los comandos siguientes usan PowerShell en Windows. En macOS/Linux puedes usar `npm` en lugar de `npm.cmd`.

Desde la raíz:

```powershell
npm.cmd run install:all
Copy-Item backend/.env.example backend/.env
npm.cmd run dev --prefix backend
```

En otra terminal, con Ngrok instalado y configurado:

```powershell
ngrok http 3000
```

Ngrok publica un origen como `https://tu-dominio.ngrok-free.app` y reenvía al servidor HTTP local `http://localhost:3000`. Copia el origen **sin `/api`** en **Settings → URL base de Ngrok → Guardar URL**. Alternativamente, cambia `mobile/src/environments/environment.ts` antes de compilar. Una URL guardada en Settings tiene prioridad sobre la de ese archivo.

La app consume HTTP mediante `HttpClient`, usando HTTPS en el tramo público. Esto evita excepciones de tráfico sin cifrar en Android y de App Transport Security en iOS. `ConfigService` exige HTTPS. El servicio añade el encabezado `ngrok-skip-browser-warning`, serializa los parámetros con `HttpParams` y limita cada petición a 15 segundos. No uses `localhost` como URL de la app en un teléfono: apuntaría al propio dispositivo.

Prepara Android Studio, Android SDK, JDK y un emulador o dispositivo USB según la [guía oficial para Windows](https://docs.nativescript.org/setup/windows). Después:

```powershell
Set-Location mobile
npx ns doctor android
npm.cmd run android
```

Para iOS se necesita macOS con Xcode y el entorno de NativeScript preparado. Desde `mobile/`, ejecuta `npm run ios`. Los recursos nativos mínimos están incluidos; la compilación genera `platforms/`, que no se entrega como código fuente.

## Contrato del backend

| Método y ruta | Entrada | Respuesta correcta |
|---|---|---|
| `GET /api/health` | — | `{ "status": "ok" }` |
| `GET /api/books?q=garcia` | `q` o `query`, máximo 120 caracteres | `{ "items": [...], "total": 1 }` |
| `GET /api/favorites` | — | `{ "items": [...] }` |
| `POST /api/favorites` | JSON `{ "bookId": 1 }` | Libro guardado, HTTP 200; operación idempotente |
| `DELETE /api/favorites/1` | Identificador entero positivo | HTTP 204; operación idempotente |

Si se envían `q` y `query` juntos, `q` tiene prioridad. Los parámetros repetidos se rechazan con 400. Las búsquedas usan parámetros enlazados e `instr`, por lo que `%`, `_` y las comillas no se interpretan como comodines ni SQL. Los errores devuelven JSON con `message`; un libro inexistente produce 404 y un cuerpo inválido produce 400.

Prueba manual del contrato, con el backend ejecutándose:

```powershell
Invoke-RestMethod 'http://localhost:3000/api/books?q=garcia'
Invoke-RestMethod 'http://localhost:3000/api/books?query=quijote'
Invoke-RestMethod 'http://localhost:3000/api/favorites' -Method Post -ContentType 'application/json' -Body '{"bookId":1}'
Invoke-RestMethod 'http://localhost:3000/api/favorites'
```

## Redux y Angular

Se utiliza **Redux real mediante Redux Toolkit**, sin dependencias de React. `configureStore` crea una única instancia en el servicio Angular raíz `ReadingStoreService`. Las acciones viven en `reading.actions.ts`, el reducer en `reading.reducer.ts` y los selectores en `reading.selectors.ts`.

`FavoritesComponent.read(book)` ejecuta `this.reading.store.dispatch(readNow(book))`. `observeSelection` transforma `store.subscribe` en un Observable y emite el estado inicial, incluso si Inicio se abre después del dispatch. `distinctUntilChanged` evita emisiones innecesarias. `HomeComponent.items$` usa ese selector y su vista se suscribe con `AsyncPipe`, que gestiona la baja automáticamente. El arranque Angular usa detección de cambios sin Zone y las pantallas emplean signals/AsyncPipe para actualizarse de manera reactiva.

Las vistas utilizan controles nativos (`TextField`, `Button`, `ScrollView`, `GridLayout`), no formularios HTML del navegador. Las solicitudes de red están exclusivamente en `BooksService`. Las pantallas muestran estados de carga, error y listas vacías; las escrituras se confirman antes de actualizar la UI. Los favoritos se recargan en el evento `loaded` para contemplar páginas conservadas por la navegación nativa.

## Comprobaciones

Después de instalar dependencias:

```powershell
npm.cmd test
npm.cmd run check
npm.cmd run check:files
```

`backend/test/api.test.ts` levanta Express en un puerto temporal y verifica filtros, favoritos, validación y errores JSON. `repository.test.ts` comprueba SQLite real, incluidos reinicios. `mobile/test/reading.test.ts` comprueba dispatch, selecciones reactivas, inmutabilidad, ausencia de duplicados y cancelación de suscripciones. `config.test.ts` valida nombre y URL. `check` ejecuta TypeScript para el backend y el compilador Angular para código y templates móviles. `check:files` es solo una revisión estructural; no sustituye la compilación.

**Resultado en el entorno de entrega:** las cinco pruebas que no requieren paquetes externos pasan: tres de SQLite y dos de validación. La instalación npm falló con `EACCES` al acceder al registro desde este entorno restringido. La suite HTTP no pudo cargar `express`; la suite móvil no pudo cargar `tsx`; los compiladores `tsc` y `ngc` no están instalados. Por tanto, las pruebas HTTP/Redux, la compilación Angular y la ejecución en emulador/dispositivo quedan pendientes en un entorno con las dependencias y los SDK disponibles. No se ha verificado un túnel Ngrok real ni la persistencia de AppSettings en un dispositivo.

Prueba de aceptación en dispositivo:

1. Configura Ngrok y busca `garcia`, `QUIJOTE`, una búsqueda sin coincidencias y una consulta vacía.
2. Guarda un favorito; abre Favoritos, reinicia Express y vuelve a actualizar: el libro debe seguir allí.
3. Guarda un nombre, cierra la app completamente y ábrela: Settings e Inicio deben mostrar el nombre.
4. Pulsa Leer ahora sobre dos favoritos. Inicio debe mostrar ambos sin recargar manualmente. Repetir la acción sobre uno no debe duplicarlo.
5. Quita un elemento de Inicio y comprueba que continúa en Favoritos. Elimina después su favorito y verifica que no reaparece al actualizar.
6. Detén Express o introduce otra URL HTTPS: las pantallas deben informar el error y volver a habilitar los controles.

Para regenerar la entrega con el contenido actualizado de todos los archivos:

```powershell
npm.cmd run docs
```

## Referencias oficiales consultadas

- [Plantilla oficial NativeScript Angular: dependencias](https://github.com/NativeScript/nativescript-app-templates/blob/main/packages/template-blank-ng/package.json).
- [Arranque Angular y proveedor HTTP nativo](https://github.com/NativeScript/nativescript-app-templates/blob/main/packages/template-blank-ng/src/main.ts).
- [Polyfills de la plantilla oficial](https://github.com/NativeScript/nativescript-app-templates/blob/main/packages/template-blank-ng/src/polyfills.ts).
- [ApplicationSettings: lectura y escritura persistentes](https://docs.nativescript.org/core/application-settings).
- [Redux Toolkit: configureStore](https://redux-toolkit.js.org/api/configureStore).
- [SQLite de Node.js 24](https://nodejs.org/docs/latest-v24.x/api/sqlite.html).

## Checklist de verificación

Los diez puntos están implementados en el código. La columna de comprobación indica cómo verificarlos; no implica que las comprobaciones en dispositivo ya se hayan ejecutado.

| # | Requisito | Dónde se cumple y cómo verificar |
|---|---|---|
| 1 | GET Express con querystring | `backend/src/app.ts`: `GET /api/books`, admite `q` y `query`; `repository.ts` filtra título/autor en SQLite. Consultar `?q=garcia` devuelve el libro de García Márquez. |
| 2 | Listado y formulario de búsqueda | `pages/search/search.component.html` enlaza `TextField` con `query` y el botón/teclado con `search()`; el componente actualiza la señal `books`. |
| 3 | URL Ngrok y conexión HTTP | `environments/environment.ts` define `ngrokBaseUrl`; `ConfigService` permite sobrescribirla con AppSettings. `BooksService.search` solicita `/api/books?q=...` mediante HTTP sobre TLS. Configurar la URL real y buscar desde el teléfono. |
| 4 | Servicio Angular HTTP dedicado | `services/books.service.ts` contiene todas las llamadas `HttpClient`. Los componentes inyectan este servicio y no realizan peticiones directas. |
| 5 | Settings lee el nombre persistente | `ProfileService` lee `AppSettings.getString('username', 'Lector')`; `SettingsComponent.load` recarga el valor y la vista lo muestra. Verificar tras reiniciar la app. |
| 6 | Edición persistente del nombre | `settings/edit-username.component.ts` valida y guarda mediante `ProfileService.saveUsername`; este llama a `AppSettings.setString('username', name)`. Abrir Settings de nuevo y comprobar el cambio. |
| 7 | Acción de favorito por resultado | `search.component.html` incluye ☆/★; `saveFavorite` llama a `POST /api/favorites`, que escribe en la tabla SQLite `favorites` sin duplicados. |
| 8 | Listado de Favoritos | `favorites.component.ts` carga `BooksService.favorites()`; su HTML recorre los libros devueltos por `GET /api/favorites`. Actualizar después de reiniciar Express para verificar persistencia. |
| 9 | Leer ahora despacha a Redux | `FavoritesComponent.read(book)` llama explícitamente a `store.dispatch(readNow(book))`; la acción se procesa en `reading.reducer.ts`. Pulsar Leer ahora en un favorito. |
| 10 | Inicio reactivo desde Redux | `ReadingStoreService.items$` selecciona `selectReadingItems` sobre `store.subscribe`; `home.component.html` usa `items$ | async` y lista los libros. Abrir Inicio tras el dispatch y comprobar el elemento sin petición HTTP ni recarga manual. |
````
