// Crea esquema reportes + tabla reportes.reporte_promi en DataCenter_Promigas.
// Uso: npm run db:init
import 'dotenv/config';
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'DataCenter_Promigas',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

const DDL = `
CREATE SCHEMA IF NOT EXISTS reportes;

CREATE TABLE IF NOT EXISTS reportes.reporte_promi (
  id SERIAL PRIMARY KEY,
  distribuidora TEXT,
  aseguradora TEXT,
  medio_recepcion TEXT,
  contrato TEXT,
  localidad TEXT,
  operador TEXT,
  canal TEXT,
  producto TEXT,
  tipo_contacto TEXT,
  estado TEXT,
  subtipificacion TEXT,
  motivo TEXT,
  fecha_ejecucion DATE NULL,
  base_raw TEXT,
  fecha_venta DATE NULL,
  fecha_venta_raw TEXT,
  asesor_venta TEXT,
  mes TEXT,
  cabina TEXT,
  anio INTEGER NULL,
  distribuidora_norm TEXT,
  aseguradora_norm TEXT,
  canal_norm TEXT,
  cabina_norm TEXT,
  estado_norm TEXT,
  mes_norm TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reporte_promi_fecha ON reportes.reporte_promi (fecha_ejecucion);
CREATE INDEX IF NOT EXISTS idx_reporte_promi_mes ON reportes.reporte_promi (mes_norm);
CREATE INDEX IF NOT EXISTS idx_reporte_promi_estado ON reportes.reporte_promi (estado_norm);
CREATE INDEX IF NOT EXISTS idx_reporte_promi_dist ON reportes.reporte_promi (distribuidora_norm);
CREATE INDEX IF NOT EXISTS idx_reporte_promi_cabina ON reportes.reporte_promi (cabina_norm);
`;

async function main() {
  console.log('Conectando a', process.env.DB_NAME);
  await pool.query(DDL);
  const c = await pool.query('SELECT COUNT(*)::int AS n FROM reportes.reporte_promi');
  console.log('OK esquema+tabla. Filas actuales:', c.rows[0].n);
  await pool.end();
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
