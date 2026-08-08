// SERVER-ONLY (Deno Edge Function runtime).
// GET /functions/v1/saas-list-stores?search=&status=&country=&page=1&pageSize=20
//
// SaaS Admin only. Delegates search/filter/pagination to the list_stores()
// SQL function (one round trip, includes per-store user counts and a total
// row count for pagination) instead of fetching every store into JS.

import { supabaseAdmin } from '../_shared/db.ts';
import { requireSaasAdminSession, authErrorResponse } from '../_shared/authMiddleware.ts';
import { handlePreflight } from '../_shared/cors.ts';
import { jsonResponse, isValidStoreStatus } from '../_shared/saasHelpers.ts';

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  const origin = req.headers.get('origin');

  if (req.method !== 'GET') {
    return jsonResponse(405, { code: 'METHOD_NOT_ALLOWED', message: 'Use GET.' }, origin);
  }

  try {
    await requireSaasAdminSession(req);
  } catch (error) {
    const { status, body } = authErrorResponse(error);
    return jsonResponse(status, body, origin);
  }

  const url = new URL(req.url);
  const search = url.searchParams.get('search')?.trim() || null;
  const statusParam = url.searchParams.get('status');
  const status = statusParam && isValidStoreStatus(statusParam) ? statusParam : null;
  const country = url.searchParams.get('country')?.trim() || null;

  const pageRaw = Number(url.searchParams.get('page') ?? '1');
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;

  const pageSizeRaw = Number(url.searchParams.get('pageSize') ?? String(DEFAULT_PAGE_SIZE));
  const pageSize =
    Number.isFinite(pageSizeRaw) && pageSizeRaw >= 1
      ? Math.min(Math.floor(pageSizeRaw), MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE;

  const { data, error } = await supabaseAdmin.rpc('list_stores', {
    p_search: search,
    p_status: status,
    p_country: country,
    p_page: page,
    p_page_size: pageSize,
  });

  if (error) {
    console.error('[saas-list-stores] query failed:', error.message);
    return jsonResponse(500, { code: 'INTERNAL_ERROR', message: 'Could not load stores.' }, origin);
  }

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const totalCount = rows.length > 0 ? Number(rows[0].total_count) : 0;
  const totalPages = pageSize > 0 ? Math.max(Math.ceil(totalCount / pageSize), 1) : 1;

  const stores = rows.map((row) => ({
    id: row.id,
    storeCode: row.store_code,
    businessName: row.business_name,
    ownerName: row.owner_name,
    mobile: row.mobile,
    country: row.country,
    currencyCode: row.currency_code,
    status: row.status,
    createdAt: row.created_at,
    userCount: Number(row.user_count),
  }));

  return jsonResponse(
    200,
    {
      stores,
      pagination: { page, pageSize, totalCount, totalPages },
    },
    origin
  );
});
