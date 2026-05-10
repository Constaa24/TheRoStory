import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2"
import { getCorsHeaders, isAllowedOrigin } from "../_shared/cors.ts"

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
async function deleteUserStorage(adminClient: SupabaseClient, userId: string): Promise<void> {
  for (const { bucket, prefix } of userStoragePrefixes(userId)) {
    try {
      const { data: files, error: listError } = await adminClient.storage
        .from(bucket)
        .list(prefix, { limit: 1000 })
      if (listError) {
        console.warn(`deleteUserStorage list ${bucket}/${prefix} failed`, listError.message)
        continue
      }
      if (!files || files.length === 0) continue

      const paths = files
        .filter((f) => f && f.name && !f.name.endsWith('/'))
        .map((f) => `${prefix}/${f.name}`)
      if (paths.length === 0) continue

      const { error: removeError } = await adminClient.storage.from(bucket).remove(paths)
      if (removeError) {
        console.warn(`deleteUserStorage remove ${bucket}/${prefix} failed`, removeError.message)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.warn(`deleteUserStorage unexpected error for ${bucket}/${prefix}:`, message)
    }
  }
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    })
  }

  // Belt-and-suspenders: getCorsHeaders already maps disallowed origins to
  // the canonical prod origin so the browser blocks the response. This
  // also rejects scripted clients that ignore CORS entirely.
  const origin = req.headers.get('Origin')
  if (origin && !isAllowedOrigin(origin)) {
    return new Response(JSON.stringify({ error: 'Origin not allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 403,
    })
  }

  try {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY) {
      return new Response(JSON.stringify({ error: 'Server not configured' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    // All actions require authentication - verify Authorization header first
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Invalid authorization header format' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
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
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
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

      const { error } = await adminClient.auth.admin.deleteUser(user.id)
      if (error) {
        console.error('deleteOwnAccount failed', error.message)
        return new Response(JSON.stringify({ error: 'Failed to delete account' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        })
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // GDPR data export — returns all data we hold about the requesting user.
    if (action === 'exportOwnData') {
      try {
        const [profileRes, articlesRes, commentsRes, favoritesRes, roleRes] = await Promise.all([
          adminClient.from('profiles').select('*').eq('id', user.id).maybeSingle(),
          adminClient.from('articles').select('*').eq('user_id', user.id),
          adminClient.from('comments').select('*').eq('user_id', user.id),
          adminClient.from('favorites').select('*').eq('user_id', user.id),
          adminClient.from('user_roles').select('role').eq('user_id', user.id).maybeSingle(),
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
        }

        return new Response(JSON.stringify(exported), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error('exportOwnData failed', message)
        return new Response(JSON.stringify({ error: 'Failed to export data' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        })
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
      return new Response(JSON.stringify({ error: 'Failed to verify admin role' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    if (!roleData || roleData.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
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

      let profiles: Array<Record<string, any>> = []
      let roles: Array<Record<string, any>> = []
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
          createdAt: u.created_at
        }
      })

      const total = typeof usersPageData?.total === 'number' ? usersPageData.total : null
      const hasMore = usersPageData?.nextPage != null
        ? true
        : (typeof total === 'number' ? page * perPage < total : users.length === perPage)

      return new Response(JSON.stringify({
        users: usersWithDetails,
        page,
        perPage,
        total,
        hasMore,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    if (action === 'updateUserRole') {
      const { userId, role } = body
      if (!userId || !role) {
        return new Response(JSON.stringify({ error: 'Missing userId or role' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        })
      }
      if (!['admin', 'writer', 'reader'].includes(role)) {
        return new Response(JSON.stringify({ error: 'Invalid role' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        })
      }

      // Prevent admins from demoting themselves — protects against the
      // sole-admin lockout scenario where the only admin accidentally
      // leaves the system with no admin.
      if (userId === user.id && role !== 'admin') {
        return new Response(JSON.stringify({ error: 'Admins cannot demote themselves' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        })
      }

      const { error } = await adminClient
        .from('user_roles')
        .upsert({ user_id: userId, role }, { onConflict: 'user_id' })

      if (error) throw error

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    if (action === 'deleteUser') {
      const { id } = body
      if (!id) {
        return new Response(JSON.stringify({ error: 'Missing user id' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        })
      }

      if (id === user.id) {
        return new Response(JSON.stringify({ error: 'Cannot delete your own account' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        })
      }

      // Storage objects don't cascade with auth.users — clean them up
      // first so they don't orphan in the bucket. Articles/comments rows
      // cascade via the FK (migration 20260511000000).
      await deleteUserStorage(adminClient, id)

      const { error } = await adminClient.auth.admin.deleteUser(id)
      if (error) throw error

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('admin-api error:', message)
    return new Response(JSON.stringify({ error: 'An internal error occurred' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
