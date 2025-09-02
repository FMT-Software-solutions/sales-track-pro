import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface PlatformData {
  platform: string
  architecture: string
  downloadUrl: string
  fileSize: number
  status?: string
  isCritical?: boolean
  minimumVersion?: string
}

interface ReleaseData {
  version: string
  release_notes: string
  platforms?: PlatformData[]
  // Legacy single platform support (for backward compatibility)
  downloadUrl?: string
  platform?: string
  architecture?: string
  fileSize?: number
  isDraft?: boolean
  isCritical?: boolean
  minimumVersion?: string
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  try {
    // Verify request method
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { 
          status: 405,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          }
        }
      )
    }

    // Get request body
    const releaseData: ReleaseData = await req.json()

    // Validate required fields
    if (!releaseData.version || !releaseData.release_notes) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: version and release_notes' }),
        { 
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          }
        }
      )
    }

    // Check if we have platforms array or legacy single platform data
    const hasPlatformsArray = releaseData.platforms && releaseData.platforms.length > 0
    const hasLegacyData = releaseData.download_url && releaseData.platform
    
    if (!hasPlatformsArray && !hasLegacyData) {
      return new Response(
        JSON.stringify({ error: 'Either platforms array or legacy platform data is required' }),
        { 
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          }
        }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Check if version already exists
    const { data: existingVersion, error: checkError } = await supabase
      .from('app_versions')
      .select('version')
      .eq('version', releaseData.version)
      .single()

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking existing version:', checkError)
      return new Response(
        JSON.stringify({ error: 'Database error while checking version' }),
        { 
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          }
        }
      )
    }

    if (existingVersion) {
      return new Response(
        JSON.stringify({ error: `Version ${releaseData.version} already exists` }),
        { 
          status: 409,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          }
        }
      )
    }

    // Prepare platform data for insertion
    let platformsToInsert: any[] = []
    
    if (hasPlatformsArray) {
      // Use new platforms array format
      platformsToInsert = releaseData.platforms!.map(platform => ({
        version: releaseData.version,
        release_notes: releaseData.release_notes,
        download_url: platform.downloadUrl,
        platform: platform.platform,
        architecture: platform.architecture,
        file_size: platform.fileSize || 0,
        status: platform.status || 'published',
         is_critical: platform.isCritical || false,
         minimum_version: platform.minimumVersion,
         is_latest: platform.status === 'published',
         published_at: platform.status === 'published' ? new Date().toISOString() : null
      }))
    } else {
      // Use legacy single platform format for backward compatibility
      platformsToInsert = [{
        version: releaseData.version,
        release_notes: releaseData.release_notes,
        download_url: releaseData.downloadUrl || '',
        platform: releaseData.platform || 'win32',
        architecture: releaseData.architecture || 'x64',
        file_size: releaseData.fileSize || 0,
        status: releaseData.isDraft ? 'draft' : 'published',
        is_critical: releaseData.isCritical || false,
        minimum_version: releaseData.minimumVersion,
        is_latest: true,
        published_at: releaseData.isDraft ? null : new Date().toISOString()
      }]
    }

    // Mark all previous versions as not latest for each platform
    for (const platformData of platformsToInsert) {
      const { error: updateError } = await supabase
        .from('app_versions')
        .update({ is_latest: false })
        .eq('platform', platformData.platform)
        .neq('version', releaseData.version)

      if (updateError) {
        console.error(`Error updating previous versions for platform ${platformData.platform}:`, updateError)
        return new Response(
          JSON.stringify({ error: `Failed to update previous versions for platform ${platformData.platform}` }),
          { 
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            }
          }
        )
      }
    }

    // Insert new version records for all platforms
    const { data, error } = await supabase
      .from('app_versions')
      .insert(platformsToInsert)
      .select()

    if (error) {
      console.error('Error inserting version:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to publish release' }),
        { 
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          }
        }
      )
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Release ${releaseData.version} published successfully`,
        data 
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      }
    )
  }
})