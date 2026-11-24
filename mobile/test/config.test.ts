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
