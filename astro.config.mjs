import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// Dominios que el dev server acepta en la cabecera `Host`.
// Antes: `allowedHosts: true` (cualquiera), y también en el server de Vite.
// Eso habilita inyección de Host / envenenamiento de caché si `astro dev` se
// levanta en la red (host 0.0.0.0, ver `server.host` más abajo).
//
// OJO: `allowedHosts` SOLO existe en el dev server. El bundle de producción
// (`dist/server/entry.mjs`) no lo incluye, así que esto no protege el deploy:
// para eso está el TLS del proxy y `APP_BASE_URL` (ver src/lib/env.ts).
// Se deja el default de Astro (solo el host de la petición) si no se define.
const ALLOWED_HOSTS = (process.env.ALLOWED_HOSTS ?? '')
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean);
const hostsPermitidos = ALLOWED_HOSTS.length > 0 ? ALLOWED_HOSTS : undefined;

// https://astro.build/config
  export default defineConfig({
    output: 'server',
    adapter: node({ mode: 'standalone' }),
    integrations: [react()],
    prefetch: {
      prefetchAll: true,
      defaultStrategy: 'hover',
    },
    vite: {
      // Dependencias que se pre-empaquetan AL ARRANCAR.
      //
      // Sin esto, Vite descubre `motion/react` y `lucide-react` la primera vez
      // que el navegador pide una isla, re-optimiza el grafo en ese momento y
      // cambia los hashes `?v=` de los deps ya cargados. Las peticiones en vuelo
      // se quedan sirviendo la version vieja y responden 504 "Outdated Optimize
      // Dep": la isla no hidrata, React no monta y el portal se ve vacio (tampoco
      // cambia el tema, porque el boton es una isla).
      //
      // Declararlas aqui elimina el re-descubrimiento: los hashes son estables
      // desde el primer request.
      optimizeDeps: {
        include: [
          'react',
          'react-dom',
          'react-dom/client',
          'react/jsx-runtime',
          'motion/react',
          'lucide-react',
          'recharts',
        ],
      },
      server: {
        ...(hostsPermitidos ? { allowedHosts: hostsPermitidos } : {}),
      },
      plugins: [tailwindcss()],
    },
    server: {
      host: '0.0.0.0',
      port: 4321,
      ...(hostsPermitidos ? { allowedHosts: hostsPermitidos } : {}),
    },
  });
