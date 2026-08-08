// SERVER-ONLY (Deno Edge Function runtime).
// GET /functions/v1/saas-get-store?id=<uuid>
//
// SaaS Admin only. Returns store details, users summary, the Store Admin's
// info, and a slice of recent audit activity for that store.

import { supabaseAdmin } from '../_shared/db.ts';
import { requireSaasAdminSession, authErrorResponse } from '../_shared/authMiddleware.ts';
import { handlePreflight } from '../_shared/cors.ts';
import { jsonResponse, isValidUuid } from '../_shared/saasHelpers.ts';

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
  const id = url.searchParams.get('id');

  if (!isValidUuid(id)) {
    return jsonResponse(400, { code: 'BAD_REQUEST', message: 'A valid store id is required.' }, origin);
  }

  const { data: store, error: storeError } = await supabaseAdmin
    .from('stores')
    .select(
      'id, store_code, business_name, legal_name, owner_name, mobile, whatsapp, email, address_line_1, address_line_2, city, state, country, postal_code, currency_code, timezone, tax_number, logo_url, status, created_at, updated_at'
    )
    .eq('id', id)
    .maybeSingle();

  if (storeError || !store) {
    return jsonResponse(404, { code: 'STORE_NOT_FOUND', message: 'Store not found.' }, origin);
  }

  const { data: users } = await supabaseAdmin
    .from('store_users')
    .select('id, login_id, full_name, status, last_login_at, created_at, role_id, roles(name)')
    .eq('store_id', id)
    .order('created_at', { ascending: true });

  const usersList = (users ?? []).map((u) => ({
    id: u.id,
    loginId: u.login_id,
    fullName: u.full_name,
    status: u.status,
    lastLoginAt: u.last_login_at,
    createdAt: u.created_at,
    roleName: (u as { roles: { name: string } | null }).roles?.name ?? null,
  }));

  const totalUsers = usersList.length;
  const activeUsers = usersList.filter((u) => u.status === 'active').length;
  const disabledUsers = usersList.filter((u) => u.status === 'disabled').length;

  // "The" Store Admin, for display purposes: earliest-created user holding
  // the store's "Store Admin" role. Purely informational — not an
  // authorization decision.
  const { data: adminRole } = await supabaseAdmin
    .from('roles')
    .select('id')
    .eq('store_id', id)
    .eq('name', 'Store Admin')
    .maybeSingle();

  const adminUser = adminRole
    ? (users ?? []).find((u) => u.role_id === adminRole.id) ?? null
    : null;

  const { count: auditActivityCount } = await supabaseAdmin
    .from('audit_logs')
    .select('id', { count: 'exact', head: true })
    .eq('store_id', id);

  const { data: recentActivity } = await supabaseAdmin
    .from('audit_logs')
    .select('id, action, created_at, saas_admin_id, metadata')
    .eq('store_id', id)
    .order('created_at', { ascending: false })
    .limit(10);

  return jsonResponse(
    200,
    {
      store: {
        id: store.id,
        storeCode: store.store_code,
        businessName: store.business_name,
        legalName: store.legal_name,
        ownerName: store.owner_name,
        mobile: store.mobile,
        whatsapp: store.whatsapp,
        email: store.email,
        addressLine1: store.address_line_1,
        addressLine2: store.address_line_2,
        city: store.city,
        state: store.state,
        country: store.country,
        postalCode: store.postal_code,
        currencyCode: store.currency_code,
        timezone: store.timezone,
        taxNumber: store.tax_number,
        logoUrl: store.logo_url,
        status: store.status,
        createdAt: store.created_at,
        updatedAt: store.updated_at,
      },
      usersSummary: { totalUsers, activeUsers, disabledUsers },
      users: usersList,
      admin: adminUser
        ? {
            id: adminUser.id,
            loginId: adminUser.login_id,
            fullName: adminUser.full_name,
            status: adminUser.status,
            lastLoginAt: adminUser.last_login_at,
          }
        : null,
      usage: {
        userCount: totalUsers,
        auditActivityCount: auditActivityCount ?? 0,
      },
      recentActivity: (recentActivity ?? []).map((a) => ({
        id: a.id,
        action: a.action,
        createdAt: a.created_at,
        performedBySaasAdmin: Boolean(a.saas_admin_id),
      })),
    },
    origin
  );
});
