import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const PROD_ORIGINS = [
  'https://therostory.com',
  'https://www.therostory.com',
]

const DEV_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
]

const IS_LOCAL = Deno.env.get('SUPABASE_URL')?.includes('localhost') || Deno.env.get('SUPABASE_URL')?.includes('127.0.0.1')
const ALLOWED_ORIGINS = IS_LOCAL ? [...PROD_ORIGINS, ...DEV_ORIGINS] : PROD_ORIGINS

function isAllowedOrigin(origin: string): boolean {
  // Production-only CORS. Preview deployments are intentionally excluded:
  // the previous regex matched any `the-rostory-*.vercel.app`, which Vercel
  // doesn't reserve globally — anyone could deploy a project with that name
  // prefix and call this function from their origin. Use a staging Supabase
  // project for preview deploys instead.
  return ALLOWED_ORIGINS.includes(origin);
}

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') || ''
  const allowedOrigin = isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
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

    // Service-role client for admin operations
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    // Create a user-scoped client to verify the token
    const userClient = createClient(supabaseUrl, anonKey, {
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
      if (!userId || !role) throw new Error('Missing userId or role')
      if (!['admin', 'writer', 'reader'].includes(role)) {
        return new Response(JSON.stringify({ error: 'Invalid role' }), {
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
      if (!id) throw new Error('Missing user id')

      if (id === user.id) {
        return new Response(JSON.stringify({ error: 'Cannot delete your own account' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        })
      }

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
