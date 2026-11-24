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
