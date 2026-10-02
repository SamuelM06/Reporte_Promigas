// ============================================================================
// Abstracción de respuesta que comprime (gzip/brotli) cuando:
//   - el cliente lo acepta (Accept-Encoding) y
//   - el Content-Type es compresible.
// Intercepta res.write/res.end/res.writeHead/res.setHeader/res.removeHeader
// con un Proxy, de modo que cualquier intento de escribir (SSR de Astro y el
// pipe de estáticos de `send`) pase SIEMPRE por el stream de compresión.
// ============================================================================
import { createBrotliCompress, createGzip } from 'node:zlib';
import { Writable } from 'node:stream';

const NO_COMPRIMIR = [
  'application/octet-stream',
  'application/pdf',
  'application/zip',
  'image/',
  'font/',
  'audio/',
  'video/',
];

function esCompresible(contentType) {
  if (!contentType) return true;
  const tipo = String(contentType).split(';')[0].trim().toLowerCase();
  if (NO_COMPRIMIR.some((p) => tipo.startsWith(p))) return false;
  return (
    tipo.startsWith('text/') ||
    /^application\/(?:[a-z0-9._,+-]*\+)?json$/.test(tipo) ||
    /^application\/(javascript|x-javascript|xml|xhtml)/.test(tipo) ||
    tipo === 'image/svg+xml'
  );
}

// Cabecera de caché según el tipo de recurso estático:
//   - /vendor/ y /_astro/: archivos con hash de contenido => inmutables (el
//     navegador no vuelve a pedirlos hasta que cambie el hash del build).
//   - /data/ y /logos/: nombres fijos (GEOJSON de Colombia, logos), pueden
//     cambiar sin cambiar de nombre => corto (1 día + SWR).
function cabeceraCache(url) {
  if (/^\/(vendor|_astro)\//i.test(url)) {
    return 'public, max-age=31536000, immutable';
  }
  if (/^\/(data|logos)\//i.test(url)) {
    return 'public, max-age=86400, stale-while-revalidate=604800';
  }
  return null;
}

function crearProxyRespuesta(req, res) {
  // Referencias al ServerResponse original ANTES de cualquier override.
  const raw = {
    writeHead: res.writeHead.bind(res),
    setHeader: res.setHeader.bind(res),
    removeHeader: res.removeHeader.bind(res),
    write: res.write.bind(res),
    end: res.end.bind(res),
  };

  let tipoContenido = '';
  let zlibStream = null;
  let comprimiendo = false;
  let onwritePendientes = [];

  function iniciarCompresion() {
    if (res.statusCode === 204 || res.statusCode === 304) return false;
    if (!esCompresible(tipoContenido)) return false;

    const accept = String(req.headers['accept-encoding'] ?? '');
    const usaBrotli = /\bbr\b/i.test(accept);
    const usaGzip = /\bgzip\b/i.test(accept);
    if (!usaBrotli && !usaGzip) return false;

    zlibStream = usaBrotli ? createBrotliCompress() : createGzip();

    raw.removeHeader('content-length');
    raw.setHeader('content-encoding', usaBrotli ? 'br' : 'gzip');
    raw.setHeader('vary', 'accept-encoding');

    // Si el cliente se fue (navegó a otra página, cerró la pestaña o canceló
    // un prefetch), `res` ya está destruido: escribir en él lanza
    // ERR_STREAM_DESTROYED. Sin este try/catch, ese error sube como 'error' del
    // Writable SIN listener y tumba el proceso entero (el portal se cae
    // entero por un clic). Un 'error' en un stream sin handler es fatal.
    const salida = new Writable({
      write(chunk, _enc, cb) {
        if (res.writableEnded || res.destroyed) { cb(); return; }
        try { raw.write(chunk, cb); } catch { cb(); }
      },
      final(cb) {
        if (!res.writableEnded && !res.destroyed) {
          try { raw.end(); } catch { /* ya destruido */ }
        }
        cb();
      },
    });

    // Backpressure: cuando zlib drena, despertar el pipe de `send` (res
    // emite 'drain') y ejecutar los callbacks de escrituras pendientes.
    zlibStream.on('drain', () => {
      res.emit('drain');
      const q = onwritePendientes;
      onwritePendientes = [];
      for (const cb of q) cb();
    });

    // Soltar todo cuando la conexión muere, sin propagar el error.
    // Es idempotente: en el camino normal ya está todo cerrado y no hace nada.
    const soltar = () => {
      try { zlibStream.unpipe(salida); } catch { /* ya soltado */ }
      try { zlibStream.destroy(); } catch { /* ya destruido */ }
      try { salida.destroy(); } catch { /* ya destruido */ }
    };
    zlibStream.on('error', soltar);
    salida.on('error', soltar);
    res.on('close', soltar);
    res.on('error', soltar);

    zlibStream.pipe(salida);

    comprimiendo = true;
    return true;
  }

  return new Proxy(res, {
    get(target, prop) {
      switch (prop) {
        case 'writeHead':
          // Si aún no se decidió, se decide al momento de enviar cabeceras.
          return (...args) => {
            if (!comprimiendo) iniciarCompresion();
            const url = String(req.url || '');
            const cc = cabeceraCache(url);
            if (cc) raw.setHeader('cache-control', cc);
            return raw.writeHead(...args);
          };
        case 'setHeader':
          return (name, value) => {
            const nom = String(name).toLowerCase();
            if (nom === 'content-type') {
              tipoContenido = String(value);
            }
            if (comprimiendo && nom === 'content-length') {
              return res;
            }
            if (nom === 'cache-control') {
              const url = String(req.url || '');
              const cc = cabeceraCache(url);
              if (cc) return raw.setHeader(name, cc);
            }
            return raw.setHeader(name, value);
          };
        case 'removeHeader':
          return (name) => raw.removeHeader(name);
        case 'write':
          return (chunk, enc, cb) => {
            if (!comprimiendo) iniciarCompresion();
            if (!comprimiendo) {
              if (typeof enc === 'function' && cb === undefined) {
                return raw.write(chunk, enc);
              }
              return raw.write(chunk, enc, cb);
            }
            if (typeof cb === 'function') onwritePendientes.push(cb);
            return zlibStream.write(chunk);
          };
        case 'end':
          return (chunk, enc, cb) => {
            if (!comprimiendo) {
              if (typeof enc === 'function' && cb === undefined) {
                return raw.end(chunk, enc);
              }
              return raw.end(chunk, enc, cb);
            }
            if (chunk != null && chunk.length) zlibStream.end(chunk);
            else zlibStream.end();
            if (typeof cb === 'function') onwritePendientes.push(cb);
            return res;
          };
        default:
          return Reflect.get(target, prop);
      }
    },
    set(target, prop, value) {
      return Reflect.set(target, prop, value);
    },
  });
}

export { crearProxyRespuesta };