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
