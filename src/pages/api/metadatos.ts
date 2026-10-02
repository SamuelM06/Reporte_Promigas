import type { APIRoute } from 'astro';
import { getMetadatos, parseFiltros } from '../../lib/query';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  try {
    const f = parseFiltros(url);
    return Response.json(await getMetadatos(f));
  } catch (e: any) {
    return Response.json({ error: e?.message ?? 'metadatos' }, { status: 500 });
  }
};
