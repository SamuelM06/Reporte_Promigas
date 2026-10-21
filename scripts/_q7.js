// Consulta auxiliar: apto / no apto / retenido por gasera.
// Las credenciales salen del `.env` (process.env); nunca se escriben en el
// código: este archivo está versionado en un repositorio público.
require('dotenv/config');
const { Pool } = require('pg');

const p = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'DataCenter_Promigas',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

const sql = `SELECT gasera_norm,
  COUNT(*)::int total,
  COUNT(*) FILTER (WHERE cabina_norm='INBOUND')::int inbound,
  COUNT(*) FILTER (WHERE cabina_norm='OUTBOUND')::int outbound,
  COUNT(*) FILTER (WHERE estado_norm IN ('CANCELADO','CANCELADO + REINTEGRO','CANCELADO + VENTA','CANCELADA + VENTA','RETENIDO'))::int aptos,
  COUNT(*) FILTER (WHERE NOT (estado_norm IN ('CANCELADO','CANCELADO + REINTEGRO','CANCELADO + VENTA','CANCELADA + VENTA','RETENIDO')))::int noaptos,
  COUNT(*) FILTER (WHERE estado_norm IN ('RETENIDO','CANCELADO + VENTA','CANCELADA + VENTA'))::int ret
  FROM reportes.reporte_promi GROUP BY gasera_norm ORDER BY gasera_norm`;
p.query(sql).then(r => { console.log(JSON.stringify(r.rows, null, 2)); return p.end(); }).catch(e => { console.error(e); p.end(); });
