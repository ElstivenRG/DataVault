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
