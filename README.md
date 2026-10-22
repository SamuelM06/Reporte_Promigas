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

## Actualizar los datos (cuando llega un Excel nuevo)

El portal **no lee el Excel**: consulta PostgreSQL (`reportes.reporte_promi`).
El Excel de `data/` es solo la fuente, y `data/ACUMULADO_ENERO_DICIEMBRE_2026_PROMI.xlsx`
está referenciado con su nombre exacto en `scripts/load-excel.mjs`. Por eso **reemplazar
el archivo no actualiza el portal**: hay que volver a cargarlo.

```bash
# 1. Reemplazar el Excel en data/ con el MISMO nombre de archivo
# 2. Revisar el archivo antes de tocar la base (no modifica nada)
npm run db:auditar
# 3. Respaldar + cargar + verificar en un solo comando
npm run db:actualizar
```

`db:actualizar` deja una copia del Excel anterior en `backups/` (fuera de git),
carga en `DataCenter_Promigas` y comprueba que el número de filas de la tabla
cuadre con el Excel. `db:auditar` no toca la base: reporta qué celdas no se
leen bien y deja `CORRECCIONES_PENDIENTES.csv` con la fila exacta a corregir.

### Requisitos del archivo que llega

El loader lee la hoja **`Base`** y las **primeras 20 columnas por posición**
(no por nombre del encabezado), así que el orden importa:

| # | Columna | # | Columna | # | Columna | # | Columna |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A | DISTRIBUIDORA | F | OPERADOR | K | SUBTIPIFICACION | P | asesor de venta |
| B | ASEGURADORA | G | CANAL | L | MOTIVO | Q | Mes |
| C | MEDIO DE RECEPCION | H | PRODUCTO | M | FECHA DE EJECUCION | R | Cabina |
| D | CONTRATO | I | TIPO DE CONTACTO | N | BASE | S | AÑO |
| E | LOCALIDAD | J | ESTADO | O | fecha de venta | T | CLASIFICACION |

Si se inserta, borra o reordena una columna, los datos se corren y **el reporte
sale mal sin dar ningún error**. `npm run db:auditar` avisa si cambia algo de esto.

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
