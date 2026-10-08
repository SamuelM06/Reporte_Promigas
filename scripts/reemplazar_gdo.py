#!/usr/bin/env python3
"""
Script para reemplazar datos de GDO en DB con archivo de validación.
Opción A: DELETE + INSERT solo GDO
"""
import os
import sys
from datetime import datetime
from dotenv import load_dotenv
import psycopg2
import pandas as pd

load_dotenv()

# Configuración DB
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': int(os.getenv('DB_PORT', 5432)),
    'database': os.getenv('DB_NAME', 'DataCenter_Promigas'),
    'user': os.getenv('DB_USER'),
    'password': os.getenv('DB_PASSWORD'),
}

# Archivo de validación GDO
FILE_GDO = r'C:\Users\smena\OneDrive - Chariot & Castle Seguros SAS\Team Experiencia al Cliente - Promigas\Retención\Promigas\Gestión diaria Promigas Inb -Outbound\GDO\Informe\VALIDACION INFORMACION GDO- 24 de Junio 2026.xlsx'

# Columnas de la tabla DB
COLUMNAS_DB = [
    'gasera', 'aseguradora', 'medio_recepcion', 'contrato', 'localidad',
    'operador', 'canal', 'producto', 'tipo_contacto', 'estado',
    'subtipificacion', 'motivo', 'fecha_ejecucion', 'base_raw',
    'fecha_venta', 'fecha_venta_raw', 'asesor_venta', 'mes', 'cabina',
    'anio', 'clasificacion', 'gasera_norm', 'aseguradora_norm', 'canal_norm',
    'cabina_norm', 'estado_norm', 'mes_norm', 'clasificacion_norm'
]


def get_connection():
    """Establece conexión a la base de datos."""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        print(f"[OK] Conectado a {DB_CONFIG['database']}@{DB_CONFIG['host']}")
        return conn
    except Exception as e:
        print(f"[ERROR] Error conectando a DB: {e}")
        sys.exit(1)


def backup_gdo_actual(conn):
    """Crea backup de los datos actuales de GDO."""
    print("\n=== PASO 1: Backup de datos actuales GDO ===")
    cursor = conn.cursor()

    cursor.execute("""
        DROP TABLE IF EXISTS reportes.reporte_promi_gdo_backup;
        CREATE TABLE reportes.reporte_promi_gdo_backup AS
        SELECT * FROM reportes.reporte_promi WHERE gasera_norm = 'GDO';
    """)

    cursor.execute("SELECT COUNT(*) FROM reportes.reporte_promi_gdo_backup")
    count = cursor.fetchone()[0]
    print(f"[OK] Backup creado: {count} registros de GDO guardados")

    conn.commit()
    cursor.close()
    return count


def normalizar_estado(estado):
    """Normaliza valores de estado para retención."""
    if pd.isna(estado):
        return None
    s = str(estado).strip().upper()
    if not s:
        return None
    s = ' '.join(s.split())
    
    # Normalizar estados de retención
    if s in ('RETENIDA', 'RETENIDO'):
        return 'RETENIDO'
    if s in ('CANCELADA', 'CANCELADO'):
        return 'CANCELADO'
    if s in ('CANCELADA+VENTA', 'CANCELADO+VENTA', 'CANCELADO + VENTA'):
        return 'CANCELADO + VENTA'
    if s in ('CANCELADA+REINTEGRO', 'CANCELADO+REINTEGRO', 'CANCELADO + REINTEGRO'):
        return 'CANCELADO + REINTEGRO'
    if s in ('NO HUBO CONTACTO', 'NO CONTACTO'):
        return 'NO CONTACTO'
    return s


def normalizar_mes(mes):
    """Normaliza nombres de mes."""
    if pd.isna(mes):
        return None
    s = str(mes).strip().upper()
    if not s:
        return None
    return ' '.join(s.split())


def normalizar_clasificacion(clasif):
    """Normaliza clasificación."""
    if pd.isna(clasif):
        return None
    s = str(clasif).strip().upper()
    if not s:
        return None
    return ' '.join(s.split())


def leer_archivo_validacion():
    """Lee el archivo de validación GDO y retorna DataFrame unificado."""
    print("\n=== PASO 2: Leer archivo de validación GDO ===")

    # Leer hoja GESTIÓN INBOUND (índice 15)
    df_inbound = pd.read_excel(FILE_GDO, sheet_name=15)
    print(f"  GESTIÓN INBOUND: {len(df_inbound)} registros")

    # Leer hoja OUT (índice 4)
    df_out = pd.read_excel(FILE_GDO, sheet_name=4)
    print(f"  OUT: {len(df_out)} registros")

    # Procesar INBOUND - columnas reales de la hoja original
    df_inbound_procesado = pd.DataFrame({
        'gasera': 'GDO',
        'aseguradora': df_inbound['ENTIDAD_FACTURACION'],
        'medio_recepcion': df_inbound['CANAL'],
        'contrato': df_inbound['CONTRATO'],
        'localidad': df_inbound['LOCALIDAD'],
        'operador': df_inbound['NOMBRE_ASESOR_RETENCION'],
        'canal': df_inbound['CANAL'],
        'producto': df_inbound['PRODUCTO_1'],
        'tipo_contacto': df_inbound['TIPO_CONTACTO'],
        'estado': df_inbound['RESULTADO FINAL'].apply(normalizar_estado),
        'subtipificacion': df_inbound['SUBTIPIFICACION'],
        'motivo': df_inbound['CATEGORIA_DETALLE'],
        'fecha_ejecucion': pd.to_datetime(df_inbound['FECHA DE LLAMADA'], errors='coerce'),
        'base_raw': df_inbound['FECHA DE LLAMADA'].astype(str),
        'fecha_venta': pd.to_datetime(df_inbound['FECHA_VENTA'], errors='coerce'),
        'fecha_venta_raw': df_inbound['FECHA_VENTA'].astype(str),
        'asesor_venta': df_inbound['NOMBRE_ASESOR_VENTA'],
        'mes': df_inbound['Mes'].apply(normalizar_mes),
        'cabina': 'INBOUND',
        'anio': 2026,
        'clasificacion': df_inbound['RESULTADO FINAL'].apply(normalizar_clasificacion),
    })

    # Procesar OUT - columnas reales de la hoja
    df_out_procesado = pd.DataFrame({
        'gasera': 'GDO',
        'aseguradora': df_out['ASEGURADORA'],
        'medio_recepcion': df_out['MEDIO_RECEPCION'],
        'contrato': df_out['CONTRATO'],
        'localidad': df_out['LOCALIDAD_SOLICITUD'],
        'operador': df_out['OPERADOR'],
        'canal': df_out['CANAL'],
        'producto': df_out['PRODUCTO'],
        'tipo_contacto': df_out['TIPO DE CONTACTO'],
        'estado': df_out['ESTADO'].apply(normalizar_estado),
        'subtipificacion': df_out['SUBCATEGORIA'],
        'motivo': df_out['MOTIVO'],
        'fecha_ejecucion': pd.to_datetime(df_out['FECHA EJECUCION'], errors='coerce'),
        'base_raw': df_out['FECHA EJECUCION'].astype(str),
        'fecha_venta': pd.to_datetime(df_out['FECHA DE VENTA'], errors='coerce'),
        'fecha_venta_raw': df_out['FECHA DE VENTA'].astype(str),
        'asesor_venta': df_out['NOMBRE DEL ASESOR DE VENTA'],
        'mes': df_out['MES'].apply(normalizar_mes),
        'cabina': 'OUTBOUND',
        'anio': 2026,
        'clasificacion': df_out['Resultado de retencion'].apply(normalizar_clasificacion),
    })

    # Unir
    df_total = pd.concat([df_inbound_procesado, df_out_procesado], ignore_index=True)
    print(f"  TOTAL unificado: {len(df_total)} registros")

    return df_total


def normalizar_valores(df):
    """Normaliza valores para las columnas _norm."""
    def norm_upper(v):
        if pd.isna(v):
            return None
        s = str(v).strip()
        if not s:
            return None
        return ' '.join(s.upper().split())

    df['gasera_norm'] = df['gasera'].apply(norm_upper)
    df['aseguradora_norm'] = df['aseguradora'].apply(norm_upper)
    df['canal_norm'] = df['canal'].apply(norm_upper)
    df['cabina_norm'] = df['cabina'].apply(norm_upper)
    df['estado_norm'] = df['estado'].apply(norm_upper)
    df['mes_norm'] = df['mes'].apply(norm_upper)
    df['clasificacion_norm'] = df['clasificacion'].apply(norm_upper)

    return df


def eliminar_gdo_actual(conn):
    """Elimina los registros actuales de GDO."""
    print("\n=== PASO 3: Eliminar registros actuales de GDO ===")
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM reportes.reporte_promi WHERE gasera_norm = 'GDO'")
    count_antes = cursor.fetchone()[0]
    print(f"  Registros GDO antes de eliminar: {count_antes}")

    cursor.execute("DELETE FROM reportes.reporte_promi WHERE gasera_norm = 'GDO'")
    count_eliminados = cursor.rowcount
    print(f"  Registros eliminados: {count_eliminados}")

    conn.commit()
    cursor.close()
    return count_eliminados


def insertar_nuevos_gdo(conn, df):
    """Inserta los nuevos registros de GDO desde el archivo de validación."""
    print("\n=== PASO 4: Insertar nuevos registros de GDO ===")
    cursor = conn.cursor()

    df = normalizar_valores(df)

    def fecha_a_string(x):
        if x is None or pd.isna(x):
            return None
        if isinstance(x, str):
            if x.startswith('NaT') or x == 'nan' or x == 'NaN':
                return None
            return x
        try:
            return pd.to_datetime(x).strftime('%Y-%m-%d')
        except:
            return None

    df['fecha_ejecucion'] = df['fecha_ejecucion'].apply(fecha_a_string)
    df['fecha_venta'] = df['fecha_venta'].apply(fecha_a_string)

    df = df.replace({pd.NaT: None, float('nan'): None})
    df = df.where(pd.notna(df), None)

    BATCH = 1000
    total_insertados = 0

    for i in range(0, len(df), BATCH):
        batch = df.iloc[i:i+BATCH]
        values = []
        for _, row in batch.iterrows():
            values.append(tuple(row[COLUMNAS_DB].values))

        placeholders = ','.join(['%s'] * len(COLUMNAS_DB))
        query = f"""
            INSERT INTO reportes.reporte_promi ({','.join(COLUMNAS_DB)})
            VALUES ({placeholders})
        """

        cursor.executemany(query, values)
        total_insertados += len(batch)
        print(f"  Insertados: {total_insertados}/{len(df)}")

    conn.commit()
    cursor.close()
    print(f"[OK] Total insertados: {total_insertados}")
    return total_insertados


def validar_resultados(conn):
    """Valida que los números coincidan."""
    print("\n=== PASO 5: Validación de resultados ===")
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM reportes.reporte_promi WHERE gasera_norm = 'GDO'")
    total_gdo = cursor.fetchone()[0]
    print(f"\n  Total GDO en DB: {total_gdo}")

    cursor.execute("""
        SELECT cabina_norm, COUNT(*) 
        FROM reportes.reporte_promi 
        WHERE gasera_norm = 'GDO' 
        GROUP BY cabina_norm
    """)
    print("\n  Por cabina:")
    for row in cursor.fetchall():
        print(f"    {row[0]}: {row[1]}")

    cursor.execute("""
        SELECT mes_norm, COUNT(*) 
        FROM reportes.reporte_promi 
        WHERE gasera_norm = 'GDO' 
        GROUP BY mes_norm
        ORDER BY mes_norm
    """)
    print("\n  Por mes:")
    for row in cursor.fetchall():
        print(f"    {row[0]}: {row[1]}")

    cursor.execute("""
        SELECT estado_norm, COUNT(*) 
        FROM reportes.reporte_promi 
        WHERE gasera_norm = 'GDO' 
        GROUP BY estado_norm
        ORDER BY COUNT(*) DESC
    """)
    print("\n  Por estado:")
    for row in cursor.fetchall():
        print(f"    {row[0]}: {row[1]}")

    cursor.execute("SELECT COUNT(*) FROM reportes.reporte_promi")
    total_general = cursor.fetchone()[0]
    print(f"\n  Total general en DB: {total_general}")

    cursor.close()


def main():
    print("=" * 60)
    print("REEMPLAZO DE DATOS GDO - OPCIÓN A")
    print("=" * 60)
    print(f"Fecha: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Archivo: {FILE_GDO}")

    conn = get_connection()

    try:
        backup_gdo_actual(conn)
        df_validacion = leer_archivo_validacion()
        eliminar_gdo_actual(conn)
        insertar_nuevos_gdo(conn, df_validacion)
        validar_resultados(conn)

        print("\n" + "=" * 60)
        print("PROCESO COMPLETADO EXITOSAMENTE")
        print("=" * 60)

    except Exception as e:
        print(f"\n[ERROR] ERROR: {e}")
        conn.rollback()
        print("Se realizó rollback de la transacción")
        sys.exit(1)
    finally:
        conn.close()


if __name__ == '__main__':
    main()