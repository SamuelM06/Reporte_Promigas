# Gestión Diaria Promigas 2026

Portal de consulta del acumulado de gestión diaria de **Promigas 2026** (corte enero a septiembre),
con identidad visual Xuma y navegación siempre visible.

> Nota de privacidad: este repositorio es una plantilla pública. No contiene credenciales,
> datos reales ni información sensible: todo lo delicado vive en el entorno privado local
> (ver `.env.example`).

## Funcionalidades

- **KPIs del periodo**: total de llamadas, inbound, outbound, aptos, no aptos, retenciones y
  % de retención (Retenidos / Aptos × 100), con animaciones y conteo animado.
- **Gráfico mensual general**: columnas por mes (total, inbound, outbound, retenciones) más
  línea de % de retención en movimiento continuo.
- **Filtros activados**: Mes, Gasera, Cabina y Estado, con ítems traídos de la base de datos;
  al elegir un ítem el reporte se actualiza solo. El panel funciona igual en la carga inicial
  y después de navegar por el portal (`<ClientRouter />`).
- **Gestión mensual por aseguradora**: un solo gráfico general con las aseguradoras como columnas.
- **Tabla de gestión por mes** con totales por columna y % de retención.

## Vistas

| Ruta | Vista |
| --- | --- |
| `/` | Inicio: portada del reporte y corte vigente |
| `/dashboard` | Página 1: KPIs + gráfico mensual general + filtros |
| `/por-gasera` | Gestión por gasera: el mismo gráfico separado por gasera (página 1: principales, página 2: Efigas) |
| `/detalle` | Página 2: tabla de gestión por mes y gráfico por aseguradora |
| `/politica-datos` | Aviso de privacidad (plantilla con marcadores `<<...>>` pendientes) |

La navegación vive en una **barra superior fija** y, en pantallas pequeñas, en un **menú
lateral** que se abre con el botón ☰. Los tres elementos de navegación llevan
`transition:persist`: el router cliente nunca los desmonta, así que la navegación está
siempre disponible sin importar cuántas veces se cambie de vista.

## Estructura

```text
data/            # Excel fuente del acumulado (uso local, no versionar datos reales)
public/          # Logos, favicon, fuentes
scripts/         # Arranque, carga del Excel a la base, utilidades
src/
  components/
    charts/      # Gráfico mensual reutilizable
    filtros/     # Catálogo y panel de filtros compartido
    ui/          # Fondo animado, pie, control de tema
  layouts/       # Layout principal + layout con navegación
  lib/           # Base de datos, consultas, entorno, utilidades
  pages/         # Vistas + API (metadatos, KPIs, tendencias, tabla)
```

## Desarrollo

```bash
cp .env.example .env   # rellenar credenciales reales (nunca se sube a git)
npm install
npm run db:init        # crea esquema + tabla
npm run db:load        # carga el Excel a la tabla
npm run dev            # servidor de desarrollo
npm run build && npm start
```

### Acceso al portal

El portal valida la sesión del Hub de Xuma (cookie `xuma_session`, JWT HS256) y
no tiene login propio:

| Variable | Para qué sirve |
| --- | --- |
| `JWT_SECRET` | Secreto **compartido con el Hub**. Sin él se niega todo acceso. |
| `ALLOWED_PERSONAS` | Ids de persona (`sub` del JWT) con acceso. Vacío = nadie entra. |
| `AUTH_DEV` | `true` = **solo en local**, entra sin la cookie del Hub. Se ignora si `NODE_ENV=production`. |

En local, lo normal es `AUTH_DEV=true` (y el `JWT_SECRET` de pruebas). En
producción, `AUTH_DEV=false` y el `JWT_SECRET` debe ser el mismo del Hub.

El lanzador deja el portal en la red local:

```bash
npm run servidor       # build + arranque + verificación de rutas
```

Imprime el enlace local (`http://localhost:4321/reporte-promigas`) y el de red
(`http://<ip-del-equipo>:4321/reporte-promigas`) para abrirlo desde el celular
o desde otro equipo de la red.

> El `.env` se carga en el arranque del servidor (`scripts/serve.mjs`), no solo
> en el build: hay variables (p. ej. `AUTH_DEV`) que el código lee en caliente.


## Stack

Astro (SSR) + Node + PostgreSQL (`pg`), Tailwind CSS, identidad de marca Xuma.
