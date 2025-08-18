const fs = require('fs')
const path = require('path')

/**
 * Filters environment variables to only include VITE_ prefixed public variables
 * Creates a secure .env file for production packaging
 */
function filterPublicEnvVars() {
  const projectRoot = path.join(__dirname, '..')
  const envLocalPath = path.join(projectRoot, '.env.local')
  const envPath = path.join(projectRoot, '.env')
  const outputPath = path.join(projectRoot, '.env.production')
  
  const publicVars = new Map()
  
  // Helper function to parse env file
  function parseEnvFile(filePath) {
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  ${path.basename(filePath)} not found, skipping...`)
      return
    }
    
    console.log(`📖 Reading ${path.basename(filePath)}...`)
    const content = fs.readFileSync(filePath, 'utf8')
    
    content.split('\n').forEach((line, index) => {
      const match = line.match(/^([^#=]+)=(.*)$/)
      if (match) {
        const key = match[1].trim()
        const value = match[2].trim().replace(/^["']|["']$/g, '') // Remove quotes
        
        // Only include VITE_ prefixed variables (public variables)
        if (key.startsWith('VITE_')) {
          publicVars.set(key, value)
          console.log(`✅ Found public variable: ${key}`)
        } else {
          console.log(`🔒 Skipping private variable: ${key}`)
        }
      }
    })
  }
  
  // Parse both .env.local and .env files
  // .env.local takes precedence over .env
  parseEnvFile(envPath)
  parseEnvFile(envLocalPath)
  
  if (publicVars.size === 0) {
    console.log('⚠️  No VITE_ prefixed variables found!')
    return
  }
  
  // Generate filtered .env.production file
  const outputContent = Array.from(publicVars.entries())
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')
  
  fs.writeFileSync(outputPath, outputContent, 'utf8')
  
  console.log(`\n🎉 Created ${path.basename(outputPath)} with ${publicVars.size} public variables:`)
  publicVars.forEach((value, key) => {
    console.log(`   ${key}=${value.substring(0, 20)}${value.length > 20 ? '...' : ''}`)
  })
  
  console.log(`\n📁 Output file: ${outputPath}`)
}

// Run the filter if this script is executed directly
if (require.main === module) {
  console.log('🔧 Filtering environment variables for production...')
  filterPublicEnvVars()
}

module.exports = { filterPublicEnvVars }