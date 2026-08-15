import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2"
import { getCorsHeaders, isAllowedOrigin } from "../_shared/cors.ts"
import { createRateLimiter, getClientIp } from "../_shared/rate-limit.ts"
import { jsonResponse } from "../_shared/http.ts"

// Module-scoped service-role client. Env vars don't change between
// invocations on the same instance, so creating it once per cold start
// avoids the per-request createClient cost. Use a getter so the function
// can still respond with "Server not configured" instead of throwing
// on import when env is missing during local dev.
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

let cachedAdminClient: SupabaseClient | null = null
function getAdminClient(): SupabaseClient {
  if (!cachedAdminClient) {
    cachedAdminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  }
  return cachedAdminClient
}

// Per-IP rate limiter (shared implementation in _shared/rate-limit.ts).
// Defense-in-depth on top of the JWT/admin-role checks: caps how fast any one
// IP can hit the endpoint (e.g. an authenticated user spamming exportOwnData).
// 60/min is generous for legitimate admin paging/role edits.
const rateLimiter = createRateLimiter({
  globalKey: '__rostoryAdminRateLimit',
  windowMs: 60_000,
  max: 60,
})
const isRateLimited = (req: Request): boolean =>
  rateLimiter.isRateLimited(`ip:${getClientIp(req)}`)

// Storage paths owned by a user — these are the prefixes that uploadUserFile
// writes under. Keep this list in sync with the `subfolder:` values in
// AdminDashboard, TextStoryCreate, VideoStoryCreate, CarouselStoryCreate.
const userStoragePrefixes = (userId: string): { bucket: string; prefix: string }[] => [
  { bucket: 'avatars', prefix: userId },
  { bucket: 'articles', prefix: userId },
  { bucket: 'articles', prefix: `carousels/${userId}` },
  { bucket: 'articles', prefix: `stories/videos/${userId}` },
  { bucket: 'articles', prefix: `stories/posters/${userId}` },
]

// Best-effort recursive cleanup of all files a user owns. Errors are
// logged but not thrown — orphan storage is an annoyance, not a reason
// to block the auth row delete (which is the legally-required action).
//
// list() caps at 1000 entries per call, so we loop: each iteration
// removes the batch it listed, then re-lists from the top until the
// prefix is empty. A hard iteration cap guards against an infinite
// loop if remove() keeps failing.
async function deleteUserStorage(adminClient: SupabaseClient, userId: string): Promise<void> {
  const LIST_PAGE = 1000
  const MAX_BATCHES = 50

  for (const { bucket, prefix } of userStoragePrefixes(userId)) {
    try {
      for (let batch = 0; batch < MAX_BATCHES; batch++) {
        const { data: files, error: listError } = await adminClient.storage
          .from(bucket)
          .list(prefix, { limit: LIST_PAGE })
        if (listError) {
          console.warn(`deleteUserStorage list ${bucket}/${prefix} failed`, listError.message)
          break
        }
        if (!files || files.length === 0) break

        const paths = files
          .filter((f) => f && f.name && !f.name.endsWith('/'))
          .map((f) => `${prefix}/${f.name}`)
        if (paths.length === 0) break

        const { error: removeError } = await adminClient.storage.from(bucket).remove(paths)
        if (removeError) {
          console.warn(`deleteUserStorage remove ${bucket}/${prefix} failed`, removeError.message)
          break
        }
        // Fewer entries than the page size means the prefix is drained.
        if (files.length < LIST_PAGE) break
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.warn(`deleteUserStorage unexpected error for ${bucket}/${prefix}:`, message)
    }
  }
}

// Remove a deleted account's newsletter subscription. The table is keyed by
// email (no FK to auth.users), so account deletion doesn't cascade to it —
// without this, a deleted user's address stays subscribed. Best-effort: also
// deletes the Resend contact so broadcasts actually stop. Failures are logged,
// never thrown — they must not block the account deletion itself.
async function removeNewsletterSubscription(adminClient: SupabaseClient, email: string | null | undefined): Promise<void> {
  const normalized = (email ?? '').trim().toLowerCase()
  if (!normalized) return

  try {
    const { error } = await adminClient.from('newsletter_subscribers').delete().eq('email', normalized)
    if (error) console.warn('removeNewsletterSubscription db delete failed', error.message)
  } catch (err) {
    console.warn('removeNewsletterSubscription db delete threw', err instanceof Error ? err.message : String(err))
  }

  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
  if (!RESEND_API_KEY) return
  try {
    await fetch(`https://api.resend.com/contacts/${encodeURIComponent(normalized)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
    })
  } catch (err) {
    console.warn('removeNewsletterSubscription resend delete failed', err instanceof Error ? err.message : String(err))
  }
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' }, corsHeaders)
  }

  // Belt-and-suspenders: getCorsHeaders already maps disallowed origins to
  // the canonical prod origin so the browser blocks the response. This also
  // rejects scripted clients that *send* a disallowed Origin header; clients
  // that omit Origin entirely pass through, which is fine here because every
  // action below still requires a valid JWT.
  const origin = req.headers.get('Origin')
  if (origin && !isAllowedOrigin(origin)) {
    return jsonResponse(403, { error: 'Origin not allowed' }, corsHeaders)
  }

  if (isRateLimited(req)) {
    return jsonResponse(429, { error: 'Too many requests. Please try again later.' }, corsHeaders, { 'Retry-After': '60' })
  }

  try {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY) {
      return jsonResponse(500, { error: 'Server not configured' }, corsHeaders)
    }

    // All actions require authentication - verify Authorization header first
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonResponse(401, { error: 'Missing authorization header' }, corsHeaders)
    }
    if (!authHeader.startsWith('Bearer ')) {
      return jsonResponse(401, { error: 'Invalid authorization header format' }, corsHeaders)
    }

    const adminClient = getAdminClient()

    // User-scoped client used only to verify the JWT. Created per-request
    // because the Authorization header changes per call.
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    })
    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
      console.warn('admin-api auth.getUser failed', userError?.message)
      return jsonResponse(401, { error: 'Invalid or expired token' }, corsHeaders)
    }

    const body = await req.json()
    const action = body.action

    // Self-service actions (any authenticated user)
    if (action === 'deleteOwnAccount') {
      // Storage cleanup before the auth row delete: storage objects don't
      // cascade with auth.users, so without this they orphan forever.
      // The articles/comments rows themselves cascade via the FK
      // (migration 20260511000000), so we only need to handle storage.
      await deleteUserStorage(adminClient, user.id)
      // Newsletter is keyed by email, not user_id, so it doesn't cascade.
      await removeNewsletterSubscription(adminClient, user.email)

      const { error } = await adminClient.auth.admin.deleteUser(user.id)
      if (error) {
        console.error('deleteOwnAccount failed', error.message)
        return jsonResponse(500, { error: 'Failed to delete account' }, corsHeaders)
      }

      return jsonResponse(200, { success: true }, corsHeaders)
    }

    // GDPR data export — returns all data we hold about the requesting user.
    if (action === 'exportOwnData') {
      try {
        const normalizedEmail = (user.email ?? '').trim().toLowerCase()
        const [profileRes, articlesRes, commentsRes, favoritesRes, roleRes, newsletterRes] = await Promise.all([
          adminClient.from('profiles').select('*').eq('id', user.id).maybeSingle(),
          adminClient.from('articles').select('*').eq('user_id', user.id),
          adminClient.from('comments').select('*').eq('user_id', user.id),
          adminClient.from('favorites').select('*').eq('user_id', user.id),
          adminClient.from('user_roles').select('role').eq('user_id', user.id).maybeSingle(),
          normalizedEmail
            ? adminClient.from('newsletter_subscribers')
                .select('email, status, created_at, confirmed_at, unsubscribed_at')
                .eq('email', normalizedEmail).maybeSingle()
            : Promise.resolve({ data: null }),
        ])

        const exported = {
          exportedAt: new Date().toISOString(),
          account: {
            id: user.id,
            email: user.email,
            createdAt: user.created_at,
            emailConfirmedAt: user.email_confirmed_at,
            lastSignInAt: user.last_sign_in_at,
            role: roleRes.data?.role ?? 'reader',
          },
          profile: profileRes.data ?? null,
          articles: articlesRes.data ?? [],
          comments: commentsRes.data ?? [],
          favorites: favoritesRes.data ?? [],
          newsletter: newsletterRes.data ?? null,
        }

        return jsonResponse(200, exported, corsHeaders)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error('exportOwnData failed', message)
        return jsonResponse(500, { error: 'Failed to export data' }, corsHeaders)
      }
    }

    // Check admin role
    const { data: roleData, error: roleError } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()

    if (roleError) {
      console.error('admin-api role lookup failed', roleError.message)
      return jsonResponse(500, { error: 'Failed to verify admin role' }, corsHeaders)
    }

    if (!roleData || roleData.role !== 'admin') {
      return jsonResponse(403, { error: 'Admin access required' }, corsHeaders)
    }

    // Admin-only actions below
    if (action === 'getUsers') {
      const rawPage = Number(body.page)
      const rawPerPage = Number(body.perPage)
      const page = Number.isFinite(rawPage) ? Math.max(1, Math.floor(rawPage)) : 1
      const perPage = Number.isFinite(rawPerPage) ? Math.min(100, Math.max(1, Math.floor(rawPerPage))) : 25

      const { data: usersPageData, error: usersError } = await adminClient.auth.admin.listUsers({ page, perPage })
      if (usersError) throw usersError
      const users = usersPageData?.users ?? []
      const userIds = users.map((u) => u.id)

      type ProfileRow = { id: string; display_name?: string | null; avatar_url?: string | null }
      type RoleRow = { user_id: string; role?: string | null }
      let profiles: ProfileRow[] = []
      let roles: RoleRow[] = []
      if (userIds.length > 0) {
        const [{ data: profilesData, error: profilesError }, { data: rolesData, error: rolesError }] = await Promise.all([
          adminClient.from('profiles').select('*').in('id', userIds),
          adminClient.from('user_roles').select('*').in('user_id', userIds),
        ])

        if (profilesError) throw profilesError
        if (rolesError) throw rolesError
        profiles = profilesData ?? []
        roles = rolesData ?? []
      }

      const usersWithDetails = users.map(u => {
        const profile = profiles?.find(p => p.id === u.id)
        const roleMatch = roles?.find(r => r.user_id === u.id)
        return {
          id: u.id,
          email: u.email,
          displayName: profile?.display_name || u.user_metadata?.display_name || '',
          avatarUrl: profile?.avatar_url || u.user_metadata?.avatar_url || '',
          role: roleMatch ? roleMatch.role : 'reader',
          createdAt: u.created_at,
          emailVerified: !!u.email_confirmed_at,
        }
      })

      const total = typeof usersPageData?.total === 'number' ? usersPageData.total : null
      const hasMore = usersPageData?.nextPage != null
        ? true
        : (typeof total === 'number' ? page * perPage < total : users.length === perPage)

      return jsonResponse(200, {
        users: usersWithDetails,
        page,
        perPage,
        total,
        hasMore,
      }, corsHeaders)
    }

    if (action === 'updateUserRole') {
      const { userId, role } = body
      if (!userId || !role) {
        return jsonResponse(400, { error: 'Missing userId or role' }, corsHeaders)
      }
      if (!['admin', 'writer', 'reader'].includes(role)) {
        return jsonResponse(400, { error: 'Invalid role' }, corsHeaders)
      }

      // Prevent admins from demoting themselves — protects against the
      // sole-admin lockout scenario where the only admin accidentally
      // leaves the system with no admin.
      if (userId === user.id && role !== 'admin') {
        return jsonResponse(400, { error: 'Admins cannot demote themselves' }, corsHeaders)
      }

      const { error } = await adminClient
        .from('user_roles')
        .upsert({ user_id: userId, role }, { onConflict: 'user_id' })

      if (error) throw error

      return jsonResponse(200, { success: true }, corsHeaders)
    }

    if (action === 'deleteUser') {
      const { id } = body
      if (!id) {
        return jsonResponse(400, { error: 'Missing user id' }, corsHeaders)
      }

      if (id === user.id) {
        return jsonResponse(400, { error: 'Cannot delete your own account' }, corsHeaders)
      }

      // Storage objects don't cascade with auth.users — clean them up
      // first so they don't orphan in the bucket. Articles/comments rows
      // cascade via the FK (migration 20260511000000).
      await deleteUserStorage(adminClient, id)
      // Newsletter is keyed by email (no FK), so look up the target's email
      // and remove their subscription too.
      try {
        const { data: target } = await adminClient.auth.admin.getUserById(id)
        await removeNewsletterSubscription(adminClient, target?.user?.email)
      } catch (err) {
        console.warn('deleteUser newsletter cleanup failed', err instanceof Error ? err.message : String(err))
      }

      const { error } = await adminClient.auth.admin.deleteUser(id)
      if (error) throw error

      return jsonResponse(200, { success: true }, corsHeaders)
    }

    // Storage housekeeping. The editors clean up after themselves on save
    // and on unmount, but that unmount handler never runs if the tab is
    // killed mid-edit, and everything uploaded before those handlers
    // existed is still sitting in the bucket. list_orphaned_article_media
    // (migration 20260813164931_orphaned_article_media_cleanup.sql) is the
    // join nothing else does: bucket objects that no media_url /
    // poster_url / media_urls points at.
    //
    // Deletion goes through the Storage API, never `delete from
    // storage.objects` — the SQL path drops the metadata row and leaves
    // the bytes behind in S3, still billed, now invisible.
    if (action === 'listOrphanedMedia' || action === 'purgeOrphanedMedia') {
      // Grace period, so a file uploaded into a draft that hasn't been
      // saved yet is never a candidate. Floor of 1h even if the caller
      // asks for less; a year is plenty of ceiling.
      const rawMinAge = Number(body.minAgeHours)
      const minAgeHours = Number.isFinite(rawMinAge)
        ? Math.min(8760, Math.max(1, Math.floor(rawMinAge)))
        : 24

      const { data: orphanData, error: orphanError } = await adminClient
        .rpc('list_orphaned_article_media', { p_min_age_hours: minAgeHours })
      if (orphanError) throw orphanError

      type OrphanRow = { object_name: string; size_bytes: number | string; last_modified: string }
      const orphans = (orphanData ?? []) as OrphanRow[]
      const bytesOf = (row: OrphanRow) => Number(row.size_bytes ?? 0)
      const totalBytes = orphans.reduce((sum, row) => sum + bytesOf(row), 0)

      if (action === 'listOrphanedMedia') {
        return jsonResponse(200, {
          minAgeHours,
          count: orphans.length,
          totalBytes,
          files: orphans.map((row) => ({
            name: row.object_name,
            bytes: bytesOf(row),
            lastModified: row.last_modified,
          })),
        }, corsHeaders)
      }

      // remove() takes a batch of paths per call; keep batches modest so a
      // single failure doesn't take the whole sweep down with it.
      const REMOVE_BATCH = 100
      const bytesByName = new Map(orphans.map((row) => [row.object_name, bytesOf(row)]))
      const removedNames: string[] = []
      const failedNames: string[] = []

      for (let i = 0; i < orphans.length; i += REMOVE_BATCH) {
        const batch = orphans.slice(i, i + REMOVE_BATCH).map((row) => row.object_name)
        const { data: removed, error: removeError } = await adminClient.storage
          .from('articles')
          .remove(batch)
        if (removeError) {
          console.error('purgeOrphanedMedia batch failed', removeError.message)
          failedNames.push(...batch)
          continue
        }
        const removedInBatch = (removed ?? []).map((entry) => entry.name)
        removedNames.push(...removedInBatch)
        // Storage reports only what it actually deleted; anything the
        // batch asked for but didn't come back is still there.
        const deleted = new Set(removedInBatch)
        failedNames.push(...batch.filter((name) => !deleted.has(name)))
      }

      const freedBytes = removedNames.reduce((sum, name) => sum + (bytesByName.get(name) ?? 0), 0)
      console.log(`purgeOrphanedMedia: removed ${removedNames.length}/${orphans.length} objects, freed ${freedBytes} bytes`)

      return jsonResponse(200, {
        minAgeHours,
        candidates: orphans.length,
        removed: removedNames.length,
        failed: failedNames.length,
        freedBytes,
        totalBytes,
      }, corsHeaders)
    }

    return jsonResponse(400, { error: 'Unknown action' }, corsHeaders)

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('admin-api error:', message)
    return jsonResponse(500, { error: 'An internal error occurred' }, corsHeaders)
  }
})
