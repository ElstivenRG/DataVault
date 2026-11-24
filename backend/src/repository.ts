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
