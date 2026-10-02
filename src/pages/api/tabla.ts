import type { APIRoute } from 'astro';
import { getTabla, parseFiltros } from '../../lib/query';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  try {
    const page = Number(url.searchParams.get('page') ?? 1) || 1;
    return Response.json(await getTabla(parseFiltros(url), page, 50));
  } catch (e: any) {
    return Response.json({ error: e?.message ?? 'tabla' }, { status: 500 });
  }
};
