# Gestión Diaria Promigas 2026

Portal de consulta del acumulado de gestión diaria de **Promigas 2026** (corte enero a septiembre),
con identidad visual Xuma y navegación lateral auto-hide.

> Nota de privacidad: este repositorio es una plantilla pública. No contiene credenciales,
> datos reales ni información sensible: todo lo delicado vive en el entorno privado local
> (ver `.env.example`).

## Funcionalidades

- **KPIs del periodo**: total de llamadas, inbound, outbound, aptos, no aptos, retenciones y
  % de retención (Retenidos / Aptos × 100), con animaciones y conteo animado.
- **Gráfico mensual general**: columnas por mes (total, inbound, outbound, retenciones) más
  línea de % de retención en movimiento continuo.
- **Filtros activados**: Mes, Gasera, Cabina y Estado, con ítems traídos de la base de datos;
  al elegir un ítem el reporte se actualiza solo.
- **Gestión mensual por aseguradora**: un solo gráfico general con las aseguradoras como columnas.
- **Tabla de gestión por mes y detalle paginado** de registros.

## Vistas

| Ruta | Vista |
| --- | --- |
| `/` | Inicio: portada del reporte y corte vigente |
| `/dashboard` | Página 1: KPIs + gráfico mensual general + filtros |
| `/por-gasera` | Gestión por gasera: el mismo gráfico separado por gasera (página 1: principales, página 2: Efigas) |
| `/detalle` | Página 2: tabla de gestión por mes, gráfico por aseguradora y detalle paginado |

La navegación vive en un **sidebar lateral con iconos** que se abre al pasar el mouse por el
borde izquierdo y se esconde solo al cambiar de página.

## Estructura

```text
data/            # Excel fuente del acumulado (uso local, no versionar datos reales)
public/          # Logos, favicon, fuentes
scripts/         # Arranque, carga del Excel a la base, utilidades
src/
  components/
    charts/      # Gráfico mensual reutilizable
    filtros/     # Catálogo y panel de filtros compartido
    ui/          # Fondo animado, pie, controles de tema
  layouts/       # Layout principal + layout con sidebar
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

## Stack

Astro (SSR) + Node + PostgreSQL (`pg`), Tailwind CSS, identidad de marca Xuma.
