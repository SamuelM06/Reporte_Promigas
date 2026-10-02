# Gestión Diaria Promigas 2026

Portal de consulta del acumulado de gestión diaria **Promigas 2026** (corte enero a septiembre),
con identidad visual Xuma y navegación lateral auto-hide.

- **DB:** `DataCenter_Promigas` · esquema `reportes` · tabla `reportes.reporte_promi`
- **Fuente:** `data/ACUMULADO_ENERO_DICIEMBRE_2026_PROMI.xlsx` (hoja `Base`, 29.222 registros)
- **Stack:** Astro + Node + PostgreSQL (`pg`), misma estructura de carpetas que `03_Siniestros`

## Desarrollo

```bash
cp .env.example .env   # rellenar credenciales reales (no se sube a git)
npm install
npm run db:init        # crea esquema + tabla
npm run db:load        # carga el Excel a la tabla
npm run dev
```

## Notas de data

- La hoja `Base` trae **29.222 filas con datos** (ENE 2917, FEB 3783, MAR 3494, ABR 3089, MAY 2271, JUN 2349, JUL 4108, AGO 3044, SEP 4167).
- La columna `mes` (Q) es el grano mensual de todos los totales y gráficos.
- La columna 1 en DB se llama `gasera` (viene de DISTRIBUIDORA del Excel) + `gasera_norm` normalizada.
- Fechas mixtas (serial Excel + texto `DD/MM/YYYY` + `N/A`): se guardan `*_raw` y se parsea a `DATE` cuando es posible.
- Columnas normalizadas `*_norm` (upper + trim) para filtros y KPIs.
