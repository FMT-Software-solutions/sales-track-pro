import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create a Supabase client with the service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Get the authorization header from the request
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')

    // Verify the user making the request
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if the user has required permissions (only owners can reactivate users)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || profile?.role !== 'owner') {
      return new Response(
        JSON.stringify({ error: 'Unauthorized. Only owners can reactivate users.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get request body
    const { userId } = await req.json()

    // Validate required fields
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: userId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user exists and get their info
    const { data: userToReactivate, error: userError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (userError || !userToReactivate) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user is already active
    if (userToReactivate.is_active === true) {
      return new Response(
        JSON.stringify({ error: 'User is already active' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Reactivate the user
    // 1. Set is_active to true in profiles table
    const { error: profileUpdateError } = await supabaseAdmin
      .from('profiles')
      .update({ is_active: true })
      .eq('id', userId)

    if (profileUpdateError) {
      return new Response(
        JSON.stringify({ error: profileUpdateError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Set is_active to true in user_organizations table
    const { error: orgError } = await supabaseAdmin
      .from('user_organizations')
      .update({ is_active: true })
      .eq('user_id', userId)

    if (orgError) {
      return new Response(
        JSON.stringify({ error: orgError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Update auth user metadata to mark as active
    const { error: metadataError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      {
        user_metadata: {
          is_active: true,
          reactivated_at: new Date().toISOString(),
          reactivated_by: user.id,
          // Clear deactivation metadata
          deactivated_at: null,
          deactivated_by: null
        }
      }
    )

    if (metadataError) {
      return new Response(
        JSON.stringify({ error: metadataError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `User ${userToReactivate.full_name} (${userToReactivate.email}) has been reactivated successfully`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})