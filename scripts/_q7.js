const {Pool}=require('pg');
const p=new Pool({host:'20.7.15.40',port:5432,database:'DataCenter_Promigas',user:'samuel_mena',password:'XumaBD2026*',ssl:{rejectUnauthorized:false}});
const sql = `SELECT gasera_norm,
  COUNT(*)::int total,
  COUNT(*) FILTER (WHERE cabina_norm='INBOUND')::int inbound,
  COUNT(*) FILTER (WHERE cabina_norm='OUTBOUND')::int outbound,
  COUNT(*) FILTER (WHERE estado_norm IN ('CANCELADO','CANCELADO + REINTEGRO','CANCELADO + VENTA','CANCELADA + VENTA','RETENIDO'))::int aptos,
  COUNT(*) FILTER (WHERE NOT (estado_norm IN ('CANCELADO','CANCELADO + REINTEGRO','CANCELADO + VENTA','CANCELADA + VENTA','RETENIDO')))::int noaptos,
  COUNT(*) FILTER (WHERE estado_norm IN ('RETENIDO','CANCELADO + VENTA','CANCELADA + VENTA'))::int ret
  FROM reportes.reporte_promi GROUP BY gasera_norm ORDER BY gasera_norm`;
p.query(sql).then(r=>{console.log(JSON.stringify(r.rows,null,2));return p.end();}).catch(e=>{console.error(e);p.end();});