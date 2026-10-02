import type { APIRoute } from 'astro';
import { getKpis, parseFiltros } from '../../lib/query';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  try {
    return Response.json(await getKpis(parseFiltros(url)));
  } catch (e: any) {
    return Response.json({ error: e?.message ?? 'kpis' }, { status: 500 });
  }
};
