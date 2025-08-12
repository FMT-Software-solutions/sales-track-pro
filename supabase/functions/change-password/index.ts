import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create both service role client (for admin operations) and regular client (for password verification)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify the user making the request
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { currentPassword, newPassword, isFirstTimeReset } = await req.json()

    if (!newPassword) {
      return new Response(
        JSON.stringify({ error: 'New password is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // For first-time password reset, we don't need to verify current password
    // Check if user actually requires password reset for first-time reset
    if (isFirstTimeReset) {
      if (!user.user_metadata?.requires_password_reset) {
        return new Response(
          JSON.stringify({ error: 'User does not require password reset' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    } else {
      if (!currentPassword) {
        return new Response(
          JSON.stringify({ error: 'Current password is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Verify current password by attempting to sign in with regular client
      const { error: signInError } = await supabaseClient.auth.signInWithPassword({
        email: user.email!,
        password: currentPassword
      })

      if (signInError) {
        return new Response(
          JSON.stringify({ error: 'Current password is incorrect' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Update password and clear reset requirement using admin client
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { 
        password: newPassword,
        user_metadata: {
          ...user.user_metadata,
          requires_password_reset: false,
          temp_password_generated_at: null
        }
      }
    )

    if (updateError) {
      return new Response(
        JSON.stringify({ error: 'Failed to update password', details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Only generate a new session for first-time resets (auto-login)
    // For regular password changes, we want the user to be logged out for security
    if (isFirstTimeReset) {
      const { data: sessionData, error: sessionError } = await supabaseClient.auth.signInWithPassword({
        email: user.email!,
        password: newPassword
      })

      if (sessionError) {
        // Password was updated but session creation failed - still return success
        console.error('Failed to create new session:', sessionError)
        return new Response(
          JSON.stringify({ 
            message: 'Password updated successfully',
            warning: 'Please log in again with your new password'
          }),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      return new Response(
        JSON.stringify({ 
          message: 'Password updated successfully',
          session: sessionData.session
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    } else {
      // For regular password changes, don't provide a new session
      return new Response(
        JSON.stringify({ 
          message: 'Password updated successfully',
          requiresLogout: true
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})