import type { APIRoute } from 'astro';
import { getTendencia, parseFiltros } from '../../lib/query';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  try {
    return Response.json(await getTendencia(parseFiltros(url)));
  } catch (e: any) {
    return Response.json({ error: e?.message ?? 'tendencia' }, { status: 500 });
  }
};
