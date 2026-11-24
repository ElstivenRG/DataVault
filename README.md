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
