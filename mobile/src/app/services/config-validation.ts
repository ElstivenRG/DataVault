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
