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
