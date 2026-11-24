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
