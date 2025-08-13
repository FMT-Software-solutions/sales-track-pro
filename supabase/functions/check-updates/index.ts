import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
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
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    )

    // Get request body
    const { platform, currentVersion } = await req.json()

    if (!platform) {
      return new Response(
        JSON.stringify({ success: false, error: 'Platform is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Query for the latest published version for the platform
    const { data: versions, error } = await supabaseClient
      .from('app_versions')
      .select('*')
      .eq('status', 'published')
      .eq('platform', platform)
      .order('created_at', { ascending: false })
      .limit(1)

    if (error) {
      console.error('Database error:', error)
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch versions' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Helper function to compare semantic versions
    function compareVersions(a: string, b: string): number {
      const parseVersion = (version: string) => {
        return version.replace(/^v/, '').split('.').map(num => parseInt(num, 10))
      }
      
      const versionA = parseVersion(a)
      const versionB = parseVersion(b)
      
      for (let i = 0; i < Math.max(versionA.length, versionB.length); i++) {
        const numA = versionA[i] || 0
        const numB = versionB[i] || 0
        
        if (numA > numB) return 1
        if (numA < numB) return -1
      }
      
      return 0
    }

    if (Array.isArray(versions) && versions.length > 0) {
      const latestVersion = versions[0]
      const isNewer = currentVersion ? compareVersions(latestVersion.version, currentVersion) > 0 : true
      
      return new Response(
        JSON.stringify({
          success: true,
          hasUpdate: isNewer,
          currentVersion: currentVersion || 'unknown',
          latestVersion: isNewer ? latestVersion : null
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        hasUpdate: false,
        currentVersion: currentVersion || 'unknown',
        latestVersion: null
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})