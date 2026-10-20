
require('dotenv').config()

const { createClient } = require('@supabase/supabase-js')

// Load credentials securely from .env
const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SECRET_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables!')
  process.exit(1)
}

// Create Supabase connection
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
})

// Read tickets from PostgreSQL
async function testDatabase() {
  console.log('Connecting to SmartRouteDB...')

  const { data, error } = await supabase
    .from('tickets')
    .select('id, title, category, priority, status')
    .order('id', { ascending: true })

  if (error) {
    console.error('Database Error:', error.message)
    process.exitCode = 1
    return
  }

  console.log('Supabase connected successfully!')
  console.log('Total Tickets:', data.length)

  console.table(data)
}

testDatabase().catch(error => {
  console.error('Connection failed:', error.message)
  process.exitCode = 1
})
