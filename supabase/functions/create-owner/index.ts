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
    // Validate environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const provisioningSecret= Deno.env.get('PROVISIONING_SECRET')

     // Get request body with error handling
     let requestBody
     try {
       requestBody = await req.json()
     } catch (parseError) {
       return new Response(
         JSON.stringify({ error: 'Invalid JSON in request body' }),
         { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       )
     }
     
     // Validate provisioning secret
     if (requestBody.provisioningSecret !== provisioningSecret) {
       return new Response(
         JSON.stringify({ error: 'Invalid provisioning key' }),
         { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       )
     }
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create a Supabase client with the service role key
    const supabaseAdmin = createClient(
      supabaseUrl,
      supabaseServiceKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const { organizationDetails, userDetails, productId, appName } = requestBody

    // Validate required fields
    if (!organizationDetails || !userDetails || !productId ) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: organizationDetails, userDetails, productId, appName' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate organization details
    const { id: organizationId, name: organizationName, email: organizationEmail, phone: phoneNumber, address } = organizationDetails
    if (!organizationId || !organizationName || !organizationEmail) {
      return new Response(
        JSON.stringify({ error: 'Missing required organization fields: id, name, email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate user details
    const { firstName, lastName, email: userEmail, password: userTemporalPassword } = userDetails
    if (!firstName || !lastName || !userEmail || !userTemporalPassword) {
      return new Response(
        JSON.stringify({ error: 'Missing required user fields: firstName, lastName, email, password' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(userEmail) || !emailRegex.test(organizationEmail)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if organization already exists
    const { data: existingOrg, error: orgCheckError } = await supabaseAdmin
      .from('organizations')
      .select('id')
      .eq('id', organizationId)
      .single()

    if (orgCheckError && orgCheckError.code !== 'PGRST116') { // PGRST116 is "not found" error
      return new Response(
        JSON.stringify({ error: `Failed to check organization: ${orgCheckError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (existingOrg) {
      return new Response(
        JSON.stringify({ error: 'Organization already exists' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user email already exists
    const { data: existingUser, error: userCheckError } = await supabaseAdmin.auth.admin.listUsers()
    if (userCheckError) {
      return new Response(
        JSON.stringify({ error: `Failed to check existing users: ${userCheckError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const emailExists = existingUser.users.some(user => user.email === userEmail)
    if (emailExists) {
      return new Response(
        JSON.stringify({ error: 'User email already exists' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create the organization first
    const { data: newOrganization, error: createOrgError } = await supabaseAdmin
      .from('organizations')
      .insert({
        id: organizationId,
        name: organizationName,
        email: organizationEmail,
        phone: phoneNumber || null,
        address: address || null,
        is_active: true
      })
      .select()
      .single()

    if (createOrgError) {
      return new Response(
        JSON.stringify({ error: `Failed to create organization: ${createOrgError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create the admin user in Supabase Auth
    const fullName = `${firstName} ${lastName}`
    const { data: newUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email: userEmail,
      password: userTemporalPassword,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role: 'admin',
        requires_password_reset: true
      }
    })

    if (createUserError) {
      // Cleanup: delete the organization if user creation fails
      try {
        await supabaseAdmin
          .from('organizations')
          .delete()
          .eq('id', organizationId)
      } catch (deleteError) {
        console.error('Failed to cleanup organization:', deleteError)
      }
      return new Response(
        JSON.stringify({ error: `Failed to create user: ${createUserError.message}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!newUser?.user?.id) {
      // Cleanup: delete the organization if user creation fails
      try {
        await supabaseAdmin
          .from('organizations')
          .delete()
          .eq('id', organizationId)
      } catch (deleteError) {
        console.error('Failed to cleanup organization:', deleteError)
      }
      return new Response(
        JSON.stringify({ error: 'Failed to create user: No user ID returned' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create profile record
    const { error: profileInsertError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: newUser.user.id,
        email: userEmail,
        full_name: fullName,
        role: 'admin',
        branch_id: null // Owner doesn't belong to a specific branch
      })

    if (profileInsertError) {
      // Cleanup: delete the auth user and organization
      try {
        await supabaseAdmin.auth.admin.deleteUser(newUser.user.id)
        await supabaseAdmin
          .from('organizations')
          .delete()
          .eq('id', organizationId)
      } catch (deleteError) {
        console.error('Failed to cleanup:', deleteError)
      }
      return new Response(
        JSON.stringify({ error: `Failed to create user profile: ${profileInsertError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Add user to organization as admin
    const { error: orgUserError } = await supabaseAdmin
      .from('user_organizations')
      .insert({
        user_id: newUser.user.id,
        organization_id: organizationId,
        role: 'admin',
        is_active: true
      })

    if (orgUserError) {
      // Cleanup: delete everything created so far
      try {
        await supabaseAdmin.auth.admin.deleteUser(newUser.user.id)
        await supabaseAdmin
          .from('organizations')
          .delete()
          .eq('id', organizationId)
      } catch (deleteError) {
        console.error('Failed to cleanup:', deleteError)
      }
      return new Response(
        JSON.stringify({ error: `Failed to assign user to organization: ${orgUserError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        organization: {
          id: organizationId,
          name: organizationName,
          email: organizationEmail,
          phone: phoneNumber,
          address: address
        },
        user: {
          id: newUser.user.id,
          email: userEmail,
          fullName: fullName,
          role: 'admin',
          organizationId: organizationId
        },
        temporaryPassword: userTemporalPassword,
        productId: productId,
        appName: appName
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ 
        error: `Internal server error: ${error.message}`
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})