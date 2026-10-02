// ============================================================================
// PRUEBAS E2E
// ----------------------------------------------------------------------------
// Levanta el servidor SSR y valida el flujo completo.
//
// La autenticación está DESACTIVADA a propósito (commit 921e33a), pero el
// middleware conserva toda la maquinaria. Estos tests NO asumen una cosa ni la
// otra: primero sondean si el portal está abierto y ajustan las aserciones.
//
// Eso evita el fallo que tenía antes, donde las pruebas de "sin sesión →
// 401/302" fallaban porque describían un sistema que ya no existe.
//
// Uso:
//   npm run build
//   node scripts/test-e2e.mjs
//   $env:E2E_PASS="tuclave"; node scripts/test-e2e.mjs   # incluye login
// ============================================================================
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const BASE = 'http://127.0.0.1:4399';
let log = '';
let fallas = 0;
let omitidas = 0;
const fallos = [];

// Astro 5+ trae `security.checkOrigin` activo: rechaza con 403 los POST que
// no son same-origin. Un navegador SIEMPRE manda `Origin` en un POST (y en
// cualquier método distinto de GET/HEAD), así que la app no se ve afectada;
// es el cliente de pruebas el que tiene que enviarlo, igual que un navegador.
const cabecerasPost = { origin: BASE, 'sec-fetch-site': 'same-origin' };

const child = spawn(process.execPath, [join(ROOT, 'dist', 'server', 'entry.mjs')], {
  cwd: ROOT,
  env: { ...process.env, PORT: '4399' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
child.stdout.on('data', (d) => { log += d; });
child.stderr.on('data', (d) => { log += d; });

function resultado(nombre, ok, detalle = '') {
  if (ok) {
    console.log(`✅ ${nombre}${detalle ? ' :: ' + detalle : ''}`);
  } else {
    console.log(`❌ ${nombre}${detalle ? ' :: ' + detalle : ''}`);
    fallas++;
    fallos.push(nombre);
  }
}

/** Cola de salida del servidor, para no tener que adivinar el error. */
function volcarLogDelServidor() {
  const limpio = log.replace(/\x1b\[[0-9;]*m/g, '').trim();
  if (!limpio) return;
  console.log('\n──── salida del servidor ────');
  console.log(limpio.slice(-2500));
  console.log('─────────────────────────────\n');
}


function omitir(nombre, motivo) {
  omitidas++;
  console.log(`⏭️  ${nombre} :: ${motivo}`);
}

async function esperarServidor(t = 20000) {
  const ini = Date.now();
  while (Date.now() - ini < t) {
    try {
      const r = await fetch(`${BASE}/api/health`);
      if (r.ok) return true;
    } catch { /* reintenta */ }
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

async function postLogin(u, p) {
  const form = new FormData();
  form.set('username', u);
  form.set('password', p);
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    body: form,
    headers: { origin: BASE, 'sec-fetch-site': 'same-origin' },
  });
  const setCookie = res.headers.get('set-cookie') ?? '';
  const m = /xuma_sesion=([^;]+)/.exec(setCookie);
  return { status: res.status, cookie: m ? `xuma_sesion=${m[1]}` : null, setCookie };
}

async function main() {
  if (!(await esperarServidor())) {
    console.log('❌ El servidor no arrancó a tiempo.');
    console.log(log.slice(-2000));
    child.kill();
    process.exit(1);
  }

  // 0) Health check: lo que usa el orquestador para decidir si el contenedor vive.
  let res = await fetch(`${BASE}/api/health`);
  let salud = null;
  if (res.ok) salud = await res.json();
  resultado(
    'GET /api/health → 200 (liveness, sin tocar la BD)',
    res.status === 200 && salud?.ok === true && typeof salud.uptimeSeg === 'number' && salud.db === undefined,
    salud ? `uptime=${salud.uptimeSeg}s heap=${salud.memoriaMb}MB estado=${salud.estado}` : `status=${res.status}`,
  );

  res = await fetch(`${BASE}/api/health?deep=1`);
  let profundo = null;
  if (res.ok) profundo = await res.json();
  resultado(
    'GET /api/health?deep=1 → 200 (readiness, consulta a la BD)',
    res.status === 200 && profundo?.db?.ok === true,
    profundo?.db ? `latencia=${profundo.db.latenciaMs}ms` : `status=${res.status}`,
  );

  // 0b) La caché se puede purgar y responde.
  res = await fetch(`${BASE}/api/cache`, { method: 'POST', headers: cabecerasPost });
  const purgado = res.ok ? await res.json() : null;
  resultado('POST /api/cache → purga la caché', res.status === 200 && purgado?.ok === true, purgado ? `entradas=${purgado.purgado.entradas} mb=${purgado.purgado.mbLiberados}` : `status=${res.status} ${(await res.text().catch(() => '')).slice(0, 80)}`);

  res = await fetch(`${BASE}/api/cache`);
  const stats = res.ok ? await res.json() : null;
  resultado(
    'GET /api/cache → estadísticas y TTLs acotados',
    res.status === 200 && stats?.maxEntradas > 0 && stats?.staleTtlMin > 0 && stats.staleTtlMin <= 60,
    stats ? `entradas=${stats.entradas}/${stats.maxEntradas} staleTTL=${stats.staleTtlMin}min` : `status=${res.status}`,
  );

  // 1) Detectar si el portal exige sesión. La auth está desactivada a propósito,
  //    así que la respuesta correcta HOY es "abierto"; si algún día se reactiva,
  //    estas pruebas lo comprueban solas sin tocarlas.
  res = await fetch(`${BASE}/api/kpis`, { redirect: 'manual' });
  const authActiva = res.status === 401;
  console.log(
    authActiva
      ? '\n🔒 Autenticación ACTIVA: se validan los flujos con y sin sesión.\n'
      : '\n🔓 Autenticación DESACTIVADA (previsto): se validan solo los flujos con datos.\n',
  );

  if (authActiva) {
    res = await fetch(`${BASE}/`, { redirect: 'manual' });
    resultado('GET / sin sesión → 302 a /login', res.status === 302 && (res.headers.get('location') ?? '').endsWith('/login'), `status=${res.status}`);

    res = await fetch(`${BASE}/dashboard`, { redirect: 'manual' });
    resultado('GET /dashboard sin sesión → 302 a /login', res.status === 302, `status=${res.status}`);

    res = await fetch(`${BASE}/api/kpis`);
    resultado('GET /api/kpis sin sesión → 401', res.status === 401, `status=${res.status}`);

    res = await fetch(`${BASE}/api/kpis`, { headers: { cookie: 'xuma_sesion=12345.firma' } });
    resultado('API con token manipulado → 401', res.status === 401, `status=${res.status}`);
  } else {
    omitir('Redirects a /login sin sesión', 'la autenticación está desactivada (commit 921e33a)');
    omitir('401 en API sin sesión', 'la autenticación está desactivada (commit 921e33a)');
    omitir('401 con token manipulado', 'la autenticación está desactivada (commit 921e33a)');
  }

  // 2) Datos sin sesión (hoy es el modo real de operación).
  res = await fetch(`${BASE}/api/kpis`);
  let kpis = null;
  if (res.ok) kpis = await res.json();
  resultado(
    'GET /api/kpis → 200 con datos',
    res.status === 200 && kpis && typeof kpis.total === 'number' && typeof kpis.totalPagado === 'number',
    kpis ? `total=${kpis.total} pagados=${kpis.pagados} objetados=${kpis.objetados} pagadoCOP=${kpis.totalPagado}` : `status=${res.status}`,
  );

  // 3) Login (solo si hay contraseña disponible; el hash sigue en el entorno).
  const E2E_PASS = process.env.E2E_PASS ?? '';
  let sesion = null;
  if (E2E_PASS) {
    res = await postLogin(process.env.E2E_USER ?? 'analista', E2E_PASS);
    const httponly = /httpOnly/i.test(res.setCookie);
    const samesiteLax = /SameSite=Lax/i.test(res.setCookie);
    const secure = /Secure/i.test(res.setCookie);
    resultado(
      'POST login correcto → 200 + cookie httpOnly/SameSite=Lax',
      res.status === 200 && !!res.cookie && httponly && samesiteLax,
      `status=${res.status} secure=${secure}`,
    );
    sesion = res.cookie;
  } else {
    omitir('Flujo de login', 'define E2E_PASS para probarlo');
  }

  const cabeceras = sesion ? { cookie: sesion } : {};

  // 4) Gráficos y metadatos.
  const [tend, asig, gas, prod, meta] = await Promise.all(
    ['tendencia', 'por-aseguradora', 'por-gasera', 'por-producto', 'metadatos'].map(async (e) => {
      const r = await fetch(`${BASE}/api/${e}`, { headers: cabeceras });
      const body = await r.json().catch(() => null);
      const arr = Array.isArray(body) ? body : null;
      return { ok: r.ok, n: arr?.length, keys: body && typeof body === 'object' && !arr ? Object.keys(body) : undefined };
    }),
  );
  resultado(
    'Endpoints de gráficos y metadatos OK',
    tend.ok && asig.ok && gas.ok && prod.ok && meta.ok && tend.n > 0 && asig.n > 0 && gas.n > 0 && prod.n > 0,
    `tendencia=${tend.n} aseguradora=${asig.n} gasera=${gas.n} producto=${prod.n} meta.keys=${meta.keys?.join(',') ?? meta.n}`,
  );

  // 5) Tabla paginada: sin columnas personales que no deben salir.
  res = await fetch(`${BASE}/api/tabla?page=1&size=10`, { headers: cabeceras });
  let tabla = null;
  if (res.ok) tabla = await res.json();
  resultado(
    'GET /api/tabla → 200 paginado y sin campos sensibles',
    res.status === 200 && tabla && Array.isArray(tabla.registros) && tabla.registros.every((r) => !('cedula' in r) && !('datos_originales' in r)),
    `total=${tabla?.total} filas=${tabla?.registros?.length}`,
  );

  // 6) Exportación: ambos formatos deben devolver un archivo real.
  for (const formato of ['excel', 'pdf']) {
    res = await fetch(`${BASE}/api/exportar?formato=${formato}&modo=pagina&size=5&pagina=1`, { headers: cabeceras });
    const buf = res.ok ? Buffer.from(await res.arrayBuffer()) : Buffer.alloc(0);
    const ok = res.status === 200 && buf.length > 0;
    const magia = ok
      ? formato === 'pdf'
        ? buf.subarray(0, 4).toString('latin1') === '%PDF'
        : buf[0] === 0x50 && buf[1] === 0x4b
      : false;
    resultado(
      `GET /api/exportar?formato=${formato} → archivo válido`,
      ok && magia,
      `status=${res.status} bytes=${buf.length}`,
    );
  }

  // 7) HTML renderizado.
  for (const [ruta, marcador] of [
    ['/dashboard', 'Tablero'],
    ['/estatus', 'Estatus'],
    ['/detalle', 'Detalle'],
    ['/politica-datos', 'datos personales'],
  ]) {
    res = await fetch(`${BASE}${ruta}`, { headers: cabeceras });
    const html = res.ok ? await res.text() : '';
    resultado(`GET ${ruta} → 200 (HTML)`, res.status === 200 && html.includes(marcador), `status=${res.status} bytes=${html.length}`);
  }

  // 7b) El aviso de privacidad debe ser alcanzable desde cualquier pantalla.
  {
    const rutas = ['/', '/dashboard', '/mapa', '/estatus', '/detalle', '/historicos', '/proyeccion'];
    const sinEnlace = [];
    for (const ruta of rutas) {
      const rr = await fetch(`${BASE}${ruta}`, { headers: cabeceras });
      if (!rr.ok || !(await rr.text()).includes('/politica-datos')) sinEnlace.push(ruta);
    }
    resultado(
      'Aviso de privacidad enlazado en todas las vistas',
      sinEnlace.length === 0,
      sinEnlace.length ? `sin enlace: ${sinEnlace.join(', ')}` : `${rutas.length} vistas con enlace`,
    );
  }

  // 7c) La política no debe filtrar datos reales de la base ni credenciales.
  {
    const rr = await fetch(`${BASE}/politica-datos`, { headers: cabeceras });
    const pol = rr.ok ? await rr.text() : '';
    const tabla = await (await fetch(`${BASE}/api/tabla?page=1&size=5`, { headers: cabeceras }))
      .json()
      .catch(() => null);
    // Se toman dos nombres reales de la tabla y se buscan dentro del HTML de la política.
    const muestras = (tabla?.registros ?? []).slice(0, 2).map((x) => x.nombre_asegurado).filter(Boolean);
    const filtrados = muestras.filter((n) => pol.includes(n));
    const conInfra = /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}|postgres(?:ql)?:\/\/|5432/.test(pol);
    resultado(
      'Política de datos sin filtrar datos reales ni infraestructura',
      muestras.length > 0 && filtrados.length === 0 && !conInfra,
      filtrados.length ? `nombres reales en la política: ${filtrados.length}` : conInfra ? 'expone host/puerto' : `${muestras.length} nombre(s) contrastados, ninguno presente`,
    );
  }

  // 8) Headers de seguridad.
  res = await fetch(`${BASE}/dashboard`, { headers: cabeceras });
  const hs = res.headers;
  resultado(
    'Headers de seguridad presentes',
    hs.get('x-frame-options') === 'DENY' &&
      hs.get('x-content-type-options') === 'nosniff' &&
      hs.get('content-security-policy')?.includes("default-src 'self'") &&
      hs.get('referrer-policy') === 'no-referrer',
    `CSP=${(hs.get('content-security-policy') ?? '').slice(0, 40)}…`,
  );

  // 9) Paginación fuera de rango: no debe reventar.
  res = await fetch(`${BASE}/api/tabla?page=999999&size=10`, { headers: cabeceras });
  const fueraDeRango = res.ok ? await res.json() : null;
  resultado(
    'GET /api/tabla con página imposible → 200 sin filas',
    res.status === 200 && Array.isArray(fueraDeRango?.registros) && fueraDeRango.registros.length === 0,
    `status=${res.status} ${res.ok ? `filas=${fueraDeRango.registros.length}` : (await res.text().catch(() => '')).slice(0, 120)}`,
  );

  // 10) Filtro de contrato: comprueba que el SQL parametrizado no se rompe.
  res = await fetch(`${BASE}/api/tabla?page=1&size=5&contrato=000`, { headers: cabeceras });
  resultado('GET /api/tabla?contrato= → 200 (parámetro escapado)', res.status === 200, `status=${res.status}`);

  if (fallas > 0) {
    volcarLogDelServidor();
    console.log(`Pruebas fallidas: ${fallos.join(' | ')}`);
  }

  console.log(
    `\n${fallas === 0 ? '🎉' : '⚠️ '} Resultado: ${fallas === 0 ? 'todas las pruebas aplicadas pasaron' : `${fallas} fallo(s)`}` +
      ` · ${omitidas} omitida(s) · auth ${authActiva ? 'activa' : 'desactivada'}`,
  );
  child.kill();
  process.exit(fallas === 0 ? 0 : 1);
}

await main().catch((e) => { console.error('Error de prueba:', e.message); console.log(log.slice(-1500)); child.kill(); process.exit(1); });
