import type { APIRoute } from 'astro';
import { getMensualPorAseguradora, parseFiltros } from '../../lib/query';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  try {
    return Response.json(await getMensualPorAseguradora(parseFiltros(url)));
  } catch (e: any) {
    return Response.json({ error: e?.message ?? 'mensual-aseguradora' }, { status: 500 });
  }
};
