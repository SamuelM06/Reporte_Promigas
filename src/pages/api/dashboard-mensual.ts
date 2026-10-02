import type { APIRoute } from 'astro';
import { getDashboardMensual, parseFiltros } from '../../lib/query';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  try {
    return Response.json(await getDashboardMensual(parseFiltros(url)));
  } catch (e: any) {
    return Response.json({ error: e?.message ?? 'dashboard-mensual' }, { status: 500 });
  }
};
