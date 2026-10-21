// Consulta auxiliar: reparto gasera x cabina.
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

const sql = `SELECT gasera_norm, cabina_norm, COUNT(*)::int n FROM reportes.reporte_promi GROUP BY gasera_norm, cabina_norm ORDER BY gasera_norm, cabina_norm`;
p.query(sql).then(r => { console.log(JSON.stringify(r.rows)); return p.end(); }).catch(e => { console.error(e); p.end(); });
