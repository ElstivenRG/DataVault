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
