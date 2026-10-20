const {Pool}=require('pg');
const p=new Pool({host:'20.7.15.40',port:5432,database:'DataCenter_Promigas',user:'samuel_mena',password:'XumaBD2026*',ssl:{rejectUnauthorized:false}});
const sql = `SELECT gasera_norm, cabina_norm, COUNT(*)::int n FROM reportes.reporte_promi GROUP BY gasera_norm, cabina_norm ORDER BY gasera_norm, cabina_norm`;
p.query(sql).then(r=>{console.log(JSON.stringify(r.rows));return p.end();}).catch(e=>{console.error(e);p.end();});