// ============================================================================
// NORMALIZACIÓN DE DIMENSIONES
// ----------------------------------------------------------------------------
// La base `siniestros.casos` guarda estados, gaseras y productos con mucha
// variación de escritura (resultado de cargar archivos de distintas
// aseguradoras). Aquí se definen las reglas canónicas UNA sola vez, como
// fragmentos SQL reutilizables (alias de tabla SIEMPRE `c`), más helpers para
// la capa de presentación.
// ============================================================================

// ---- ESTADO → categoría canónica -------------------------------------------
export const ESTADO_SQL = `
CASE
  WHEN c.estado ILIKE '%PAGAD%' OR c.estado ILIKE '%PAGO%' THEN 'Pagado'
  WHEN c.estado ILIKE '%OBJETAD%' THEN 'Objetado'
  WHEN c.estado ILIKE '%DOCUMENTO%' OR c.estado ILIKE '%PENDIENTE%' OR c.estado ILIKE '%LLAMADA%' THEN 'Solicitud de documentos'
  WHEN c.estado ILIKE '%TRAMIT%' OR c.estado ILIKE '%TRÁMIT%' OR c.estado ILIKE '%SEGUIMIENTO%' OR c.estado ILIKE '%ABIERT%' OR c.estado ILIKE '%SUSPENSO%' OR c.estado ILIKE '%COORDINAR%' OR c.estado ILIKE '%APERTUR%' THEN 'En trámite'
  WHEN c.estado ILIKE '%CONCLU%' OR c.estado ILIKE '%CERRADO%' OR c.estado ILIKE '%DIRECTO%' OR c.estado ILIKE '%EXHUMACION%' THEN 'Concluido'
  WHEN c.estado ILIKE '%NEGAD%' OR c.estado ILIKE '%ANULAD%' OR c.estado ILIKE '%NO FALLECID%' OR c.estado ILIKE '%NO PRESTAD%' OR c.estado ILIKE '%RETORNO%' OR c.estado ILIKE '%VOLTEO%' THEN 'Negado / Anulado'
  WHEN c.estado ILIKE '%REVISION%' THEN 'En revisión'
  WHEN c.estado IS NULL OR btrim(c.estado) = '' THEN 'Sin estado'
  ELSE initcap(NULLIF(btrim(c.estado),''))
END`;

// ---- GASERA → alias canónico -------------------------------------------------
export const GASERA_SQL = `
CASE
  WHEN btrim(COALESCE(c.gasera,'')) ILIKE 'GDO%' THEN 'Gdo'
  WHEN btrim(COALESCE(c.gasera,'')) ILIKE 'GASES DE OCCIDENTE%' THEN 'Gdo'
  WHEN btrim(COALESCE(c.gasera,'')) ILIKE 'GASES DEL OCCIDENTE%' THEN 'Gdo'
  WHEN btrim(COALESCE(c.gasera,'')) ILIKE 'GASES%OCCIDENTE%' THEN 'Gdo'
  WHEN btrim(COALESCE(c.gasera,'')) ILIKE '%GDO PROEXEQUIAL%' THEN 'Gdo'
  WHEN btrim(COALESCE(c.gasera,'')) ILIKE '%CARIBE%' THEN 'Gases del Caribe'
  WHEN btrim(COALESCE(c.gasera,'')) ILIKE 'SURTIGAS%' THEN 'Surtigas'
  WHEN btrim(COALESCE(c.gasera,'')) ILIKE 'EFIGAS%' THEN 'Efigas'
  WHEN btrim(COALESCE(c.gasera,'')) ILIKE '%GUAJIRA%' THEN 'Gases de La Guajira'
  WHEN btrim(COALESCE(c.gasera,'')) ILIKE 'PROMIGAS%' THEN 'Promigas'
  WHEN btrim(COALESCE(c.gasera,'')) ILIKE 'CEO' THEN 'Ceo'
  WHEN btrim(COALESCE(c.gasera,'')) ILIKE 'COMPAÑIA ENERGETICA DE%' THEN 'Ceo'
  WHEN btrim(COALESCE(c.gasera,'')) ILIKE '%ENERG%' THEN 'Ceo'
  WHEN btrim(COALESCE(c.gasera,'')) ILIKE '%PROEXEQUIAL%' THEN 'Proexequial (aliado)'
  WHEN btrim(COALESCE(c.gasera,'')) = '' THEN 'Sin gasera'
  ELSE initcap(NULLIF(btrim(c.gasera),''))
END`;

// ---- PRODUCTO → etiqueta canónica --------------------------------------------
// Se analizan los campos reales de cada aseguradora (RAMO, Nomproducto, MODALIDAD,
// SEGURO, Ramo_Desc, PRODUCTO, etc.) y se descartan valores espurios puramente numéricos.
export const PRODUCTO_SQL = `
CASE
  -- 1. Vida Deudor / Grupo Deudores (archivos, ramos o valores explícitos)
  WHEN c.nombre_archivo_origen ILIKE '%vida deudor%' THEN 'Grupo Deudores'
  WHEN btrim(COALESCE(c.datos_originales->>'RAMO','')) ILIKE '%DEUDOR%' THEN 'Grupo Deudores'
  WHEN btrim(COALESCE(c.datos_originales->>'PRODUCTO','')) ILIKE '%DEUDOR%' THEN 'Grupo Deudores'

  -- 2. Salvafactura
  WHEN c.nombre_archivo_origen ILIKE '%salvafactura%' THEN 'Salvafactura'
  WHEN btrim(COALESCE(c.datos_originales->>'PRODUCTO','')) ILIKE '%SALVAFACTURA%' THEN 'Salvafactura'

  -- 3. Cardif (Nomproducto comercial)
  WHEN btrim(COALESCE(c.datos_originales->>'Nomproducto','')) ILIKE '%ACCID%' THEN 'Accidentes Personales'
  WHEN btrim(COALESCE(c.datos_originales->>'Nomproducto','')) ILIKE '%CANCER%' OR btrim(COALESCE(c.datos_originales->>'Nomproducto','')) ILIKE '%C_NCER%' THEN 'Cáncer'
  WHEN btrim(COALESCE(c.datos_originales->>'Nomproducto','')) ILIKE '%VIDA GRUPO%' OR btrim(COALESCE(c.datos_originales->>'Nomproducto','')) ILIKE '%VIDA%' THEN 'Vida Grupo'
  WHEN btrim(COALESCE(c.datos_originales->>'Nomproducto','')) ILIKE '%DEUDOR%' THEN 'Grupo Deudores'
  WHEN NULLIF(btrim(c.datos_originales->>'Nomproducto'),'') IS NOT NULL 
   AND (c.datos_originales->>'Nomproducto') !~ '^[0-9.,[:space:]]+$'
   THEN initcap(regexp_replace(regexp_replace(btrim(c.datos_originales->>'Nomproducto'), '^[0-9]+[[:space:]]*-[[:space:]]*', '', 'g'), '_', ' ', 'g'))

  -- 4. HDI (Modalidad / Amparo)
  WHEN btrim(COALESCE(c.datos_originales->>'MODALIDAD','')) ILIKE '%FUTURO PROTEGIDO%' THEN 'Seguro Futuro Protegido'
  WHEN btrim(COALESCE(c.datos_originales->>'MODALIDAD','')) ILIKE '%FUNERARIO%' 
    OR btrim(COALESCE(c.datos_originales->>'AMPARO','')) ILIKE '%EXEQUIAS%' THEN 'Seguro Funerario'
  WHEN btrim(COALESCE(c.datos_originales->>'MODALIDAD','')) ILIKE '%ENFERMEDADES GRAVES%' 
    OR btrim(COALESCE(c.datos_originales->>'AMPARO','')) ILIKE '%ENFERMEDADES GRAVES%' THEN 'Enfermedades Graves'

  -- 5. SURA (Ramo_Desc / SEGURO / Nombre_plan)
  WHEN btrim(COALESCE(c.datos_originales->>'Ramo_Desc','')) ILIKE '%VIDA DE GRUPO%' THEN 'Vida Grupo'
  WHEN btrim(COALESCE(c.datos_originales->>'SEGURO','')) ILIKE '%MERCADO ASEGURADO%' THEN 'Mercado Asegurado'
  WHEN btrim(COALESCE(c.datos_originales->>'Nombre_plan','')) ILIKE '%VIDA%' THEN 'Vida Grupo'

  -- 6. Campo SEGURO (Alfa / HDI / SURA)
  WHEN btrim(COALESCE(c.datos_originales->>'SEGURO','')) ILIKE '%PRACTISEGURO%' THEN 'Practiseguro'
  WHEN btrim(COALESCE(c.datos_originales->>'SEGURO','')) ILIKE '%FUTURO PROTEGIDO%' THEN 'Seguro Futuro Protegido'
  WHEN btrim(COALESCE(c.datos_originales->>'SEGURO','')) ILIKE '%PAZ Y SALVO%' OR btrim(COALESCE(c.datos_originales->>'SEGURO','')) ILIKE '%LIBERTY%' THEN 'Seguro de Vida'
  WHEN btrim(COALESCE(c.datos_originales->>'SEGURO','')) ILIKE '%ENFERMEDADES GRAVES%' THEN 'Enfermedades Graves'

  -- 7. Campo PRODUCTO descriptivo (DESCARTA VALORES PURAMENTE NUMÉRICOS)
  WHEN (c.datos_originales->>'PRODUCTO') IS NOT NULL 
   AND (c.datos_originales->>'PRODUCTO') !~ '^[0-9.,[:space:]]+$'
   AND btrim(COALESCE(c.datos_originales->>'PRODUCTO','')) <> '' THEN
    CASE
      WHEN btrim(c.datos_originales->>'PRODUCTO') ILIKE '%FUTURO PROTEGIDO%' THEN 'Seguro Futuro Protegido'
      WHEN btrim(c.datos_originales->>'PRODUCTO') ILIKE '%FUNERARIO%' THEN 'Seguro Funerario'
      WHEN btrim(c.datos_originales->>'PRODUCTO') ILIKE '%PRACTISEGURO%' THEN 'Practiseguro'
      WHEN btrim(c.datos_originales->>'PRODUCTO') ILIKE '%PROTECTOR%' THEN 'Seguro Protector'
      WHEN btrim(c.datos_originales->>'PRODUCTO') ILIKE '%VIDA%' THEN 'Seguro de Vida'
      ELSE initcap(regexp_replace(regexp_replace(btrim(c.datos_originales->>'PRODUCTO'), '^[0-9]+[[:space:]]*-[[:space:]]*', '', 'g'), '_', ' ', 'g'))
    END

  -- 8. Otros campos secundarios (RAMO, Nombre_plan)
  WHEN btrim(COALESCE(c.datos_originales->>'RAMO','')) ILIKE '%VIDA%' THEN 'Vida Grupo'
  WHEN btrim(COALESCE(c.datos_originales->>'RAMO','')) ILIKE '%EXEQUI%' OR btrim(COALESCE(c.datos_originales->>'RAMO','')) ILIKE '%FUNERARI%' THEN 'Seguro Funerario'

  ELSE 'Sin producto'
END`;

// ---- CLASE → categoría de cartera canónica ------------------------------------
// La data manda: se deriva del archivo origen (lo que la DB trae), sin asumir.
// - Deudor: archivos vida deudor (Caribe + Surtigas) y deudores históricos.
// - Salvafactura: archivo salvafactura (solo Surtigas).
// - Microseguros: microseguros Guajira/Efigas, BASE Caribe, seguimiento CEO y CMK GDO.
// - Otros: Brilla-Cardiff, SURA, Proexequial, Informes (agregados, no siniestros).
export const CLASE_SQL = `
CASE
  WHEN c.nombre_archivo_origen ILIKE '%vida deudor%' THEN 'Deudor'
  WHEN c.nombre_archivo_origen ILIKE '%salvafactura%' THEN 'Salvafactura'
  WHEN c.nombre_archivo_origen ILIKE '%deudor%' THEN 'Deudor'
  WHEN c.nombre_archivo_origen ILIKE '%microseguro%' THEN 'Microseguros'
  WHEN c.nombre_archivo_origen ILIKE 'BASE SINIESTROS CARIBE%' THEN 'Microseguros'
  WHEN c.nombre_archivo_origen ILIKE 'SINIESTROS 2026 - EFIGAS%' THEN 'Microseguros'
  WHEN c.nombre_archivo_origen ILIKE 'Siniestros CEO%' THEN 'Microseguros'
  WHEN c.nombre_archivo_origen ILIKE 'Registro de Siniestros CMK - GDO%' THEN 'Microseguros'
  ELSE 'Otros'
END`;

// ---- FECHA EFECTIVA → fecha real del siniestro ---------------------------------
// La data manda: `fecha_radicacion` es la principal, pero hay archivos que no la
// traen y sí traen fecha propia en `datos_originales`:
// - Salvafactura sin radicación trae 'FECHA RECIBIDO' (ISO con hora).
// - PROEXEQUIAL.xlsx son agregados mensuales (MES + AÑO) sin fecha: se les asigna
//   el día 1 del mes para que caigan en su año/mes real en vez de perderse.
// - Todo lo demás sin fecha (CARIBE/GUAJIRA históricos sin fecha útil) sigue NULL
//   y se excluye de las vistas con rango, igual que antes.
export const FECHA_EFECTIVA_SQL = `
COALESCE(
  c.fecha_radicacion,
  CASE
    WHEN btrim(COALESCE(c.datos_originales->>'FECHA RECIBIDO','')) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
    THEN substring(btrim(c.datos_originales->>'FECHA RECIBIDO') from 1 for 10)::date
    ELSE NULL
  END,
  CASE
    WHEN c.nombre_archivo_origen ILIKE 'PROEXEQUIAL%'
     AND btrim(COALESCE(c.datos_originales->>'AÑO','')) ~ '^[0-9]{4}$'
     AND (btrim(COALESCE(c.datos_originales->>'AÑO',''))::int BETWEEN 2018 AND 2100)
    THEN make_date(
      btrim(c.datos_originales->>'AÑO')::int,
      CASE upper(btrim(COALESCE(c.datos_originales->>'MES','')))
        WHEN 'ENERO' THEN 1 WHEN 'FEBRERO' THEN 2 WHEN 'MARZO' THEN 3
        WHEN 'ABRIL' THEN 4 WHEN 'MAYO' THEN 5 WHEN 'JUNIO' THEN 6
        WHEN 'JULIO' THEN 7 WHEN 'AGOSTO' THEN 8 WHEN 'SEPTIEMBRE' THEN 9
        WHEN 'OCTUBRE' THEN 10 WHEN 'NOVIEMBRE' THEN 11 WHEN 'DICIEMBRE' THEN 12
        ELSE NULL
      END, 1)
    ELSE NULL
  END
)`;

// ---- Clases canónicas para la UI ----------------------------------------------
export const CATEGORIAS_CLASES = [
  'Deudor',
  'Microseguros',
  'Salvafactura',
  'Otros',
] as const;

// ---- MONTO (Total Pagado) ----------------------------------------------------
// Captura todas las variantes de columnas usadas por aseguradoras (Cardif, HDI, Alfa, etc.)
// y sanea centavos ([,.]\\d{2}$) para evitar que valores con decimales se multipliquen por 100.
// La data manda: cada archivo trae su propia columna — CEO trae 'Valor pagado'
// (y 'VALOR COBRAR SEGURO'), Salvafactura trae 'VALOR ' (con espacio final);
// si el archivo no trae columna de valor (BASE Caribe), el monto queda NULL.
export const MONTO_SQL = `
COALESCE(
  NULLIF(regexp_replace(regexp_replace(btrim(c.datos_originales->>'VALOR PAGOS'), '[,.]\\d{2}$', ''), '[^0-9]', '', 'g'), '')::numeric,
  NULLIF(regexp_replace(regexp_replace(btrim(c.datos_originales->>'Valor_Pagos'), '[,.]\\d{2}$', ''), '[^0-9]', '', 'g'), '')::numeric,
  NULLIF(regexp_replace(regexp_replace(btrim(c.datos_originales->>'MONTO PAGADO'), '[,.]\\d{2}$', ''), '[^0-9]', '', 'g'), '')::numeric,
  NULLIF(regexp_replace(regexp_replace(btrim(c.datos_originales->>'VALOR -PAGADO'), '[,.]\\d{2}$', ''), '[^0-9]', '', 'g'), '')::numeric,
  NULLIF(regexp_replace(regexp_replace(btrim(c.datos_originales->>'VALOR PAGADO'), '[,.]\\d{2}$', ''), '[^0-9]', '', 'g'), '')::numeric,
  NULLIF(regexp_replace(regexp_replace(btrim(c.datos_originales->>'VALOR PAGADO '), '[,.]\\d{2}$', ''), '[^0-9]', '', 'g'), '')::numeric,
  NULLIF(regexp_replace(regexp_replace(btrim(c.datos_originales->>'Valor pagado'), '[,.]\\d{2}$', ''), '[^0-9]', '', 'g'), '')::numeric,
  NULLIF(regexp_replace(regexp_replace(btrim(c.datos_originales->>'VALOR COBRAR SEGURO'), '[,.]\\d{2}$', ''), '[^0-9]', '', 'g'), '')::numeric,
  NULLIF(regexp_replace(regexp_replace(btrim(c.datos_originales->>'VALOR_SOLICITUD_GIRO'), '[,.]\\d{2}$', ''), '[^0-9]', '', 'g'), '')::numeric,
  NULLIF(regexp_replace(regexp_replace(btrim(c.datos_originales->>'VALOR '), '[,.]\\d{2}$', ''), '[^0-9]', '', 'g'), '')::numeric,
  NULLIF(regexp_replace(regexp_replace(btrim(c.datos_originales->>'VALOR'), '[,.]\\d{2}$', ''), '[^0-9]', '', 'g'), '')::numeric,
  NULLIF(regexp_replace(regexp_replace(btrim(c.datos_originales->>'PagoReal'), '[,.]\\d{2}$', ''), '[^0-9]', '', 'g'), '')::numeric,
  NULLIF(regexp_replace(regexp_replace(btrim(c.datos_originales->>'Pagocomercial'), '[,.]\\d{2}$', ''), '[^0-9]', '', 'g'), '')::numeric,
  NULLIF(regexp_replace(regexp_replace(btrim(c.datos_originales->>'VALOR_TOTAL'), '[,.]\\d{2}$', ''), '[^0-9]', '', 'g'), '')::numeric
)`;

// ---- Estados canónicos para la UI (badges, leyendas) --------------------------
export const CATEGORIAS_ESTADOS = [
  'Pagado',
  'Objetado',
  'Solicitud de documentos',
  'En trámite',
  'Concluido',
  'Negado / Anulado',
  'En revisión',
  'Sin estado',
] as const;

export function estadoColorCat(estado: string): 'verde' | 'rojo' | 'ambar' | 'azul' | 'morado' | 'gris' | 'cyan' {
  switch (estado) {
    case 'Pagado':
      return 'verde';
    case 'Objetado':
      return 'rojo';
    case 'Solicitud de documentos':
      return 'ambar';
    case 'En trámite':
      return 'azul';
    case 'Concluido':
      return 'cyan';
    case 'Negado / Anulado':
      return 'rojo';
    case 'En revisión':
      return 'morado';
    default:
      return 'gris';
  }
}

// ---- DEPARTAMENTO → normalización geográfica canónica -----------------------
export const DEPARTAMENTO_SQL = `
CASE
  -- 1. Departamento explícito en datos originales
  WHEN btrim(COALESCE(c.datos_originales->>'DEPARTAMENTO','')) ILIKE '%ATLANT%' THEN 'Atlántico'
  WHEN btrim(COALESCE(c.datos_originales->>'DEPARTAMENTO','')) ILIKE '%MAGDAL%' THEN 'Magdalena'
  WHEN btrim(COALESCE(c.datos_originales->>'DEPARTAMENTO','')) ILIKE '%CESAR%' THEN 'Cesar'
  WHEN btrim(COALESCE(c.datos_originales->>'DEPARTAMENTO','')) ILIKE '%BOLIV%' THEN 'Bolívar'
  WHEN btrim(COALESCE(c.datos_originales->>'DEPARTAMENTO','')) ILIKE '%CORDOB%' THEN 'Córdoba'
  WHEN btrim(COALESCE(c.datos_originales->>'DEPARTAMENTO','')) ILIKE '%SUCRE%' THEN 'Sucre'
  WHEN btrim(COALESCE(c.datos_originales->>'DEPARTAMENTO','')) ILIKE '%GUAJIR%' THEN 'La Guajira'
  WHEN btrim(COALESCE(c.datos_originales->>'DEPARTAMENTO','')) ILIKE '%VALLE%' THEN 'Valle del Cauca'
  WHEN btrim(COALESCE(c.datos_originales->>'DEPARTAMENTO','')) ILIKE '%CAUCA%' THEN 'Cauca'
  WHEN btrim(COALESCE(c.datos_originales->>'DEPARTAMENTO','')) ILIKE '%CALDAS%' THEN 'Caldas'
  WHEN btrim(COALESCE(c.datos_originales->>'DEPARTAMENTO','')) ILIKE '%RISAR%' THEN 'Risaralda'
  WHEN btrim(COALESCE(c.datos_originales->>'DEPARTAMENTO','')) ILIKE '%QUIND%' THEN 'Quindío'
  WHEN btrim(COALESCE(c.datos_originales->>'DEPARTAMENTO','')) ILIKE '%ANTIOQ%' THEN 'Antioquia'
  WHEN btrim(COALESCE(c.datos_originales->>'DEPARTAMENTO','')) ILIKE '%SANTAND%' THEN 'Santander'

  -- 2. Deducir departamento por ciudad o municipio registrado
  WHEN btrim(COALESCE(c.datos_originales->>'CIUDAD DEL RECLAMANTE ', c.datos_originales->>'CIUDAD', c.datos_originales->>'MUNICIPIO', '')) ILIKE '%BARRANQUILL%'
    OR btrim(COALESCE(c.datos_originales->>'CIUDAD DEL RECLAMANTE ', c.datos_originales->>'CIUDAD', c.datos_originales->>'MUNICIPIO', '')) ILIKE '%SOLEDAD%'
    OR btrim(COALESCE(c.datos_originales->>'CIUDAD DEL RECLAMANTE ', c.datos_originales->>'CIUDAD', c.datos_originales->>'MUNICIPIO', '')) ILIKE '%MALAMBO%'
    OR btrim(COALESCE(c.datos_originales->>'CIUDAD DEL RECLAMANTE ', c.datos_originales->>'CIUDAD', c.datos_originales->>'MUNICIPIO', '')) ILIKE '%SABANALARGA%'
    OR btrim(COALESCE(c.datos_originales->>'CIUDAD DEL RECLAMANTE ', c.datos_originales->>'CIUDAD', c.datos_originales->>'MUNICIPIO', '')) ILIKE '%PUERTO COLOMBIA%'
    OR btrim(COALESCE(c.datos_originales->>'CIUDAD DEL RECLAMANTE ', c.datos_originales->>'CIUDAD', c.datos_originales->>'MUNICIPIO', '')) ILIKE '%GALAPA%'
    OR btrim(COALESCE(c.datos_originales->>'CIUDAD DEL RECLAMANTE ', c.datos_originales->>'CIUDAD', c.datos_originales->>'MUNICIPIO', '')) ILIKE '%BARANOA%' THEN 'Atlántico'

  WHEN btrim(COALESCE(c.datos_originales->>'CIUDAD DEL RECLAMANTE ', c.datos_originales->>'CIUDAD', c.datos_originales->>'MUNICIPIO', '')) ILIKE '%SANTA MARTA%'
    OR btrim(COALESCE(c.datos_originales->>'CIUDAD DEL RECLAMANTE ', c.datos_originales->>'CIUDAD', c.datos_originales->>'MUNICIPIO', '')) ILIKE '%CIENAGA%'
    OR btrim(COALESCE(c.datos_originales->>'CIUDAD DEL RECLAMANTE ', c.datos_originales->>'CIUDAD', c.datos_originales->>'MUNICIPIO', '')) ILIKE '%FUNDACION%'
    OR btrim(COALESCE(c.datos_originales->>'CIUDAD DEL RECLAMANTE ', c.datos_originales->>'CIUDAD', c.datos_originales->>'MUNICIPIO', '')) ILIKE '%ARACATACA%'
    OR btrim(COALESCE(c.datos_originales->>'CIUDAD DEL RECLAMANTE ', c.datos_originales->>'CIUDAD', c.datos_originales->>'MUNICIPIO', '')) ILIKE '%BANANERA%' THEN 'Magdalena'

  WHEN btrim(COALESCE(c.datos_originales->>'CIUDAD DEL RECLAMANTE ', c.datos_originales->>'CIUDAD', c.datos_originales->>'MUNICIPIO', '')) ILIKE '%VALLEDUPAR%'
    OR btrim(COALESCE(c.datos_originales->>'CIUDAD DEL RECLAMANTE ', c.datos_originales->>'CIUDAD', c.datos_originales->>'MUNICIPIO', '')) ILIKE '%AGUACHICA%'
    OR btrim(COALESCE(c.datos_originales->>'CIUDAD DEL RECLAMANTE ', c.datos_originales->>'CIUDAD', c.datos_originales->>'MUNICIPIO', '')) ILIKE '%CODAZZI%'
    OR btrim(COALESCE(c.datos_originales->>'CIUDAD DEL RECLAMANTE ', c.datos_originales->>'CIUDAD', c.datos_originales->>'MUNICIPIO', '')) ILIKE '%LA PAZ%' THEN 'Cesar'

  WHEN btrim(COALESCE(c.datos_originales->>'CIUDAD DEL RECLAMANTE ', c.datos_originales->>'CIUDAD', c.datos_originales->>'MUNICIPIO', '')) ILIKE '%CARTAGENA%'
    OR btrim(COALESCE(c.datos_originales->>'CIUDAD DEL RECLAMANTE ', c.datos_originales->>'CIUDAD', c.datos_originales->>'MUNICIPIO', '')) ILIKE '%TURBACO%'
    OR btrim(COALESCE(c.datos_originales->>'CIUDAD DEL RECLAMANTE ', c.datos_originales->>'CIUDAD', c.datos_originales->>'MUNICIPIO', '')) ILIKE '%MAGANGUE%'
    OR btrim(COALESCE(c.datos_originales->>'CIUDAD DEL RECLAMANTE ', c.datos_originales->>'CIUDAD', c.datos_originales->>'MUNICIPIO', '')) ILIKE '%ARJONA%' THEN 'Bolívar'

  WHEN btrim(COALESCE(c.datos_originales->>'CIUDAD DEL RECLAMANTE ', c.datos_originales->>'CIUDAD', c.datos_originales->>'MUNICIPIO', '')) ILIKE '%MONTERIA%'
    OR btrim(COALESCE(c.datos_originales->>'CIUDAD DEL RECLAMANTE ', c.datos_originales->>'CIUDAD', c.datos_originales->>'MUNICIPIO', '')) ILIKE '%CERETE%'
    OR btrim(COALESCE(c.datos_originales->>'CIUDAD DEL RECLAMANTE ', c.datos_originales->>'CIUDAD', c.datos_originales->>'MUNICIPIO', '')) ILIKE '%LORICA%'
    OR btrim(COALESCE(c.datos_originales->>'CIUDAD DEL RECLAMANTE ', c.datos_originales->>'CIUDAD', c.datos_originales->>'MUNICIPIO', '')) ILIKE '%SAHAGUN%' THEN 'Córdoba'

  WHEN btrim(COALESCE(c.datos_originales->>'CIUDAD DEL RECLAMANTE ', c.datos_originales->>'CIUDAD', c.datos_originales->>'MUNICIPIO', '')) ILIKE '%SINCELEJO%'
    OR btrim(COALESCE(c.datos_originales->>'CIUDAD DEL RECLAMANTE ', c.datos_originales->>'CIUDAD', c.datos_originales->>'MUNICIPIO', '')) ILIKE '%COROZAL%'
    OR btrim(COALESCE(c.datos_originales->>'CIUDAD DEL RECLAMANTE ', c.datos_originales->>'CIUDAD', c.datos_originales->>'MUNICIPIO', '')) ILIKE '%SAN MARCOS%' THEN 'Sucre'

  WHEN btrim(COALESCE(c.datos_originales->>'CIUDAD DEL RECLAMANTE ', c.datos_originales->>'CIUDAD', c.datos_originales->>'MUNICIPIO', '')) ILIKE '%RIOHACHA%'
    OR btrim(COALESCE(c.datos_originales->>'CIUDAD DEL RECLAMANTE ', c.datos_originales->>'CIUDAD', c.datos_originales->>'MUNICIPIO', '')) ILIKE '%MAICAO%'
    OR btrim(COALESCE(c.datos_originales->>'CIUDAD DEL RECLAMANTE ', c.datos_originales->>'CIUDAD', c.datos_originales->>'MUNICIPIO', '')) ILIKE '%URIBIA%'
    OR btrim(COALESCE(c.datos_originales->>'CIUDAD DEL RECLAMANTE ', c.datos_originales->>'CIUDAD', c.datos_originales->>'MUNICIPIO', '')) ILIKE '%MANAURE%' THEN 'La Guajira'

  WHEN btrim(COALESCE(c.datos_originales->>'CIUDAD DEL RECLAMANTE ', c.datos_originales->>'CIUDAD', c.datos_originales->>'MUNICIPIO', '')) ILIKE '%CALI%'
    OR btrim(COALESCE(c.datos_originales->>'CIUDAD DEL RECLAMANTE ', c.datos_originales->>'CIUDAD', c.datos_originales->>'MUNICIPIO', '')) ILIKE '%PALMIRA%'
    OR btrim(COALESCE(c.datos_originales->>'CIUDAD DEL RECLAMANTE ', c.datos_originales->>'CIUDAD', c.datos_originales->>'MUNICIPIO', '')) ILIKE '%BUENAVENTURA%'
    OR btrim(COALESCE(c.datos_originales->>'CIUDAD DEL RECLAMANTE ', c.datos_originales->>'CIUDAD', c.datos_originales->>'MUNICIPIO', '')) ILIKE '%TULUA%'
    OR btrim(COALESCE(c.datos_originales->>'CIUDAD DEL RECLAMANTE ', c.datos_originales->>'CIUDAD', c.datos_originales->>'MUNICIPIO', '')) ILIKE '%BUGA%'
    OR btrim(COALESCE(c.datos_originales->>'CIUDAD DEL RECLAMANTE ', c.datos_originales->>'CIUDAD', c.datos_originales->>'MUNICIPIO', '')) ILIKE '%YUMBO%'
    OR btrim(COALESCE(c.datos_originales->>'CIUDAD DEL RECLAMANTE ', c.datos_originales->>'CIUDAD', c.datos_originales->>'MUNICIPIO', '')) ILIKE '%JAMUNDI%' THEN 'Valle del Cauca'

  WHEN btrim(COALESCE(c.datos_originales->>'CIUDAD DEL RECLAMANTE ', c.datos_originales->>'CIUDAD', c.datos_originales->>'MUNICIPIO', '')) ILIKE '%POPAYAN%' THEN 'Cauca'
  WHEN btrim(COALESCE(c.datos_originales->>'CIUDAD DEL RECLAMANTE ', c.datos_originales->>'CIUDAD', c.datos_originales->>'MUNICIPIO', '')) ILIKE '%MANIZALES%' THEN 'Caldas'
  WHEN btrim(COALESCE(c.datos_originales->>'CIUDAD DEL RECLAMANTE ', c.datos_originales->>'CIUDAD', c.datos_originales->>'MUNICIPIO', '')) ILIKE '%PEREIRA%'
    OR btrim(COALESCE(c.datos_originales->>'CIUDAD DEL RECLAMANTE ', c.datos_originales->>'CIUDAD', c.datos_originales->>'MUNICIPIO', '')) ILIKE '%DOSQUEBRADAS%' THEN 'Risaralda'
  WHEN btrim(COALESCE(c.datos_originales->>'CIUDAD DEL RECLAMANTE ', c.datos_originales->>'CIUDAD', c.datos_originales->>'MUNICIPIO', '')) ILIKE '%ARMENIA%' THEN 'Quindío'

  -- 3. Por jurisdicción comercial de la Gasera
  WHEN btrim(COALESCE(c.gasera,'')) ILIKE '%GDO%' OR btrim(COALESCE(c.gasera,'')) ILIKE '%OCCIDENTE%' THEN 'Valle del Cauca'
  WHEN btrim(COALESCE(c.gasera,'')) ILIKE '%GUAJIRA%' THEN 'La Guajira'
  WHEN btrim(COALESCE(c.gasera,'')) ILIKE '%CEO%' OR btrim(COALESCE(c.gasera,'')) ILIKE '%ENERGETICA%' THEN 'Cauca'
  WHEN btrim(COALESCE(c.gasera,'')) ILIKE '%EFIGAS%' THEN 'Caldas'
  WHEN btrim(COALESCE(c.gasera,'')) ILIKE '%CARIBE%' THEN 'Atlántico'
  WHEN btrim(COALESCE(c.gasera,'')) ILIKE '%SURTIGAS%' THEN 'Bolívar'

  ELSE 'Otros'
END`;

// ---- MUNICIPIO → normalización canónica --------------------------------------
export const MUNICIPIO_SQL = `
CASE
  WHEN btrim(COALESCE(c.datos_originales->>'CIUDAD DEL RECLAMANTE ', c.datos_originales->>'CIUDAD', c.datos_originales->>'Ciudad', c.datos_originales->>'MUNICIPIO', c.datos_originales->>'Municipio', '')) <> ''
    THEN initcap(btrim(COALESCE(c.datos_originales->>'CIUDAD DEL RECLAMANTE ', c.datos_originales->>'CIUDAD', c.datos_originales->>'Ciudad', c.datos_originales->>'MUNICIPIO', c.datos_originales->>'Municipio', '')))
  WHEN btrim(COALESCE(c.gasera,'')) ILIKE '%GDO%' OR btrim(COALESCE(c.gasera,'')) ILIKE '%OCCIDENTE%' THEN 'Cali y Valle'
  WHEN btrim(COALESCE(c.gasera,'')) ILIKE '%GUAJIRA%' THEN 'Riohacha y Municipios'
  WHEN btrim(COALESCE(c.gasera,'')) ILIKE '%CEO%' OR btrim(COALESCE(c.gasera,'')) ILIKE '%ENERGETICA%' THEN 'Popayán y Cauca'
  WHEN btrim(COALESCE(c.gasera,'')) ILIKE '%EFIGAS%' THEN 'Manizales y Eje Cafetero'
  WHEN btrim(COALESCE(c.gasera,'')) ILIKE '%CARIBE%' THEN 'Barranquilla y Municipios'
  WHEN btrim(COALESCE(c.gasera,'')) ILIKE '%SURTIGAS%' THEN 'Cartagena y Municipios'
  ELSE 'Sin especificar'
END`;