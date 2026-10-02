# Gestión Diaria Promigas 2026

Portal de consulta del acumulado de gestión diaria **Promigas 2026** (corte enero a diciembre),
con identidad visual Xuma y navegación lateral auto-hide.

- **DB:** `DataCenter_Promigas` · esquema `reportes` · tabla `reportes.reporte_promi`
- **Fuente:** `data/ACUMULADO_ENERO_DICIEMBRE_2026_PROMI.xlsx` (hoja `Base`, 25.056 registros reales)
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

- La hoja `Base` trae dimensión `A1:BK25808` pero el autofiltro real es `A1:BK25057`:
  **25.056 filas con datos** + 751 filas totalmente vacías al final (artefacto de Excel).
- No existe combinación de hojas que sume 29.222; se cargan las 25.056 reales.
- Fechas mixtas (serial Excel + texto `DD/MM/YYYY` + `N/A`): se guardan `*_raw` y se parsea a `DATE` cuando es posible.
- Columnas normalizadas `*_norm` (upper + trim) para filtros y KPIs.
