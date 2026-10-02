// ============================================================================
// DRENAJE DE CONEXIONES HTTP
// ----------------------------------------------------------------------------
// Extraído de serve.mjs para poder PROBARLO. En Windows `process.kill(pid,
// 'SIGTERM')` no ejecuta los handlers de Node (mata el proceso a la fuerza),
// así que la lógica no se puede verificar con una señal real en este SO; en
// Linux/Docker sí. Separarla permite testearla en cualquier plataforma.
//
// Secuencia (por qué en este orden):
//   1. `close(cb)`            → deja de aceptar conexiones nuevas. `cb` dispara
//                                cuando NO queda ninguna conexión abierta.
//   2. Barrido de `closeIdleConnections()` cada 50 ms → recoge las keep-alive
//      ociosas. Sin el barrido, la conexión del cliente que acaba de recibir la
//      respuesta queda ociosa para siempre y `close(cb)` no dispara hasta su
//      timeout (~3-4 s), retrasando cada despliegue sin necesidad.
//   3. Las peticiones EN VUELTO terminan solas (es lo que queremos: no cortar
//      a medio response).
//   4. Pasado `graciaMs`, `closeAllConnections()` corta las que se colgaron.
//      Un despliegue no puede esperar indefinidamente.
// ============================================================================

/**
 * @param {import('node:http').Server} server
 * @param {number} graciaMs margen antes de cortar conexiones a la fuerza
 * @param {(msg: string) => void} [log]
 * @returns {{ drenar: () => Promise<{ cortadas: boolean; ms: number }>, enCurso: () => boolean }}
 */
export function crearDrenaje(server, graciaMs, log = () => {}) {
  let enCurso = false;
  let promesa = null;

  function drenar() {
    if (enCurso) return promesa;
    enCurso = true;
    const inicio = Date.now();

    promesa = new Promise((resolve) => {
      let listo = false;
      let t;
      let barrido;
      let cortadas = false;

      const fin = () => {
        if (listo) return;
        listo = true;
        if (t) clearTimeout(t);
        if (barrido) clearInterval(barrido);
        resolve({ cortadas, ms: Date.now() - inicio });
      };

      // 1. Dejar de aceptar conexiones nuevas. `cb` dispara cuando no queda
      //    ninguna conexión abierta.
      server.close(fin);

      // 2. `closeIdleConnections()` es de un solo disparo: recoge las keep-alive
      //    ociosas AHORA, pero la petición que estaba en vuelo se vuelve ociosa
      //    DESPUÉS de responder, y ese socket ya nadie lo recoge. El resultado
      //    era que `close(cb)` esperaba al timeout de keep-alive del cliente
      //    (~3-4 s con undici) en cada despliegue.
      //    Por eso se barley cada 50 ms mientras esperamos: en cuanto la
      //    respuesta termina y el socket queda libre, se cierra y `cb` dispara
      //    de inmediato.
      barrido = setInterval(() => server.closeIdleConnections?.(), 50);
      barrido.unref?.();

      // 3+4. Las en vuelo terminan solas; si se cuelgan, corte forzado.
      t = setTimeout(() => {
        cortadas = true;
        log(`margen de ${graciaMs}ms agotado: cortando conexiones restantes`);
        server.closeAllConnections?.();
        fin();
      }, graciaMs);
      t.unref?.();
    });

    return promesa;
  }

  return { drenar, enCurso: () => enCurso };
}
