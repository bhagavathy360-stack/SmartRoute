require('dotenv').config()
const path = require('node:path')
const crypto = require('node:crypto')
const { recommendEngineers } = require('./routingAlgorithm')
const express = require('express')
const cors = require('cors')
const { createClient } = require('@supabase/supabase-js')

const app = express()

// Never accidentally deploy the unprotected development mode to Render.
if (process.env.RENDER && process.env.NODE_ENV !== 'production') {
  console.error('Set NODE_ENV=production when deploying to Render.')
  process.exit(1)
}

// The Vite development server needs CORS. In production the app and APIs
// are served from the same Express origin; do not enable cross-origin reads.
if (process.env.NODE_ENV !== 'production') {
  app.use(cors({ origin: 'http://localhost:5173' }))
}

app.disable('x-powered-by')
app.use(express.json({ limit: '10kb' }))

/*
 * Temporary password protection for the HOSTED DEMO (not startup-grade auth).
 * - Protects all app pages and API endpoints, not just the React UI.
 * - An optional demo account can exercise ticket workflows, but cannot reset.
 * - The admin account alone can reset demo records, if explicitly enabled.
 * - Existing local development stays unchanged.
 * All passwords are read from server-side environment variables only.
 */
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1) // Render is one reverse proxy hop away.

  const admin = {
    role: 'admin',
    username: process.env.DEMO_ADMIN_USERNAME || '',
    password: process.env.DEMO_ADMIN_PASSWORD || ''
  }
  const viewer = {
    role: 'demo',
    username: process.env.DEMO_VIEWER_USERNAME || '',
    password: process.env.DEMO_VIEWER_PASSWORD || ''
  }
  const hasViewerValues = Boolean(viewer.username || viewer.password)

  // Fail closed: never start a public service without strong credentials.
  if (!admin.username || admin.username.includes(':') ||
      admin.password.length < 24 ||
      (hasViewerValues && (!viewer.username || viewer.username.includes(':') ||
        viewer.password.length < 24 || viewer.username === admin.username))) {
    console.error('Invalid demo login configuration; use strong (24+ character) credentials.')
    process.exit(1)
  }

  const accounts = hasViewerValues ? [admin, viewer] : [admin]
  const failures = new Map()
  const WINDOW_MS = 15 * 60 * 1000
  const MAX_FAILURES = 12

  const safeMatch = (input, expected) => crypto.timingSafeEqual(
    crypto.createHash('sha256').update(input).digest(),
    crypto.createHash('sha256').update(expected).digest()
  )

  app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff')
    res.set('X-Frame-Options', 'DENY')
    res.set('Referrer-Policy', 'no-referrer')
    res.set('Cache-Control', 'no-store')

    const ip = req.ip
    const now = Date.now()
    const record = failures.get(ip)
    if (record && record.until > now && record.count >= MAX_FAILURES) {
      res.set('Retry-After', String(Math.ceil((record.until - now) / 1000)))
      return res.status(429).json({ success: false, message: 'Too many login attempts' })
    }
    if (record && record.until <= now) failures.delete(ip)

    const authorization = req.get('authorization') || ''
    let username = ''
    let password = ''
    const match = /^Basic ([A-Za-z0-9+/=]+)$/.exec(authorization)
    if (match && authorization.length <= 1024) {
      const decoded = Buffer.from(match[1], 'base64').toString('utf8')
      const separator = decoded.indexOf(':')
      if (separator !== -1) {
        username = decoded.slice(0, separator)
        password = decoded.slice(separator + 1)
      }
    }

    const account = accounts.find(a =>
      safeMatch(username, a.username) && safeMatch(password, a.password)
    )

    if (!account) {
      const current = failures.get(ip)
      if (!current || current.until <= now) {
        if (failures.size >= 10000) failures.delete(failures.keys().next().value)
        failures.set(ip, { count: 1, until: now + WINDOW_MS })
      } else {
        current.count += 1
      }
      res.set('WWW-Authenticate', 'Basic realm="SmartRoute Demo", charset="UTF-8"')
      return res.status(401).json({ success: false, message: 'Demo sign-in required' })
    }
    failures.delete(ip)
    req.demoRole = account.role

    // Reject cross-site browser mutations, including cross-origin forms.
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      const origin = req.get('origin')
      let sameOrigin = false
      try {
        const parsedOrigin = new URL(origin)
        const isLoopback = ['127.0.0.1', '::1', '::ffff:127.0.0.1']
          .includes(req.socket.remoteAddress)
        const localTest = isLoopback && parsedOrigin.protocol === 'http:' &&
          ['localhost', '127.0.0.1'].includes(parsedOrigin.hostname)
        sameOrigin = parsedOrigin.host === req.get('host') &&
          (parsedOrigin.protocol === 'https:' || localTest)
      } catch (_) {
        // No or malformed Origin must not authorize a browser mutation.
      }
      if (!sameOrigin) {
        return res.status(403).json({ success: false, message: 'Invalid request origin' })
      }
    }

    return next()
  })
}

// Supabase credentials
const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SECRET_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials!')
  process.exit(1)
}

// Initialize Supabase client (server-side only)
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
})

// API 1: Health check
app.get('/api/health', (req, res) => {
  // Share only the reset permission, never server-side credentials.
  // The reset API independently checks administrator authorization.
  const localAddresses = ['127.0.0.1', '::1', '::ffff:127.0.0.1']
  const canResetDemo = process.env.ENABLE_DEMO_RESET === 'true' && (
    process.env.NODE_ENV === 'production'
      ? req.demoRole === 'admin'
      : localAddresses.includes(req.socket.remoteAddress)
  )

  res.json({
    status: 'ok',
    message: 'SmartRoute Backend Running Successfully!',
    can_reset_demo: canResetDemo
  })
})

// API 2: Retrieve all tickets from PostgreSQL
app.get('/api/tickets', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('tickets')
      .select('id, title, category, priority, status, assigned_engineer_id')
      .order('id', { ascending: true })

    if (error) {
      console.error('Database read error:', error.message)
      return res.status(500).json({
        success: false,
        message: 'Unable to retrieve tickets'
      })
    }

    return res.json({
      success: true,
      count: data.length,
      tickets: data
    })

  } catch (error) {
    console.error('GET tickets error:', error.message)

    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
})

// API 3: Create a new ticket in PostgreSQL
app.post('/api/tickets', async (req, res) => {
  try {
    const { title, category, priority } = req.body ?? {}

    // Validate description
    if (
      typeof title !== 'string' ||
      title.trim().length === 0 ||
      title.trim().length > 500
    ) {
      return res.status(400).json({
        success: false,
        message: 'Description must be 1 to 500 characters'
      })
    }

    // Validate category
    const validCategories = [
      'Network',
      'Hardware',
      'Software'
    ]

    if (!validCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category'
      })
    }

    // Validate priority
    const validPriorities = [
      'Low',
      'Medium',
      'High'
    ]

    if (!validPriorities.includes(priority)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid priority'
      })
    }

    // Insert ticket into PostgreSQL
    // Database generates ticket ID and default status
    const { data, error } = await supabase
      .from('tickets')
      .insert({
        title: title.trim(),
        category,
        priority
      })
      .select('id, title, category, priority, status')
      .single()

    if (error) {
      console.error('Database insert error:', error.message)

      return res.status(500).json({
        success: false,
        message: 'Unable to create ticket'
      })
    }

    return res.status(201).json({
      success: true,
      message: 'Ticket created successfully',
      ticket: data
    })

  } catch (error) {
    console.error('POST tickets error:', error.message)

    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
})

 // API 4: Retrieve engineers with calculated workload
app.get('/api/engineers', async (req, res) => {
  try {
    // Retrieve engineer profiles
    const { data: engineers, error: engineerError } =
      await supabase
        .from('engineers')
        .select(
          'id, name, skills, max_active_tickets, is_available'
        )
        .order('id', { ascending: true })

    if (engineerError) {
      throw engineerError
    }

    // Retrieve active assigned tickets
    const { data: activeTickets, error: ticketError } =
      await supabase
        .from('tickets')
        .select('assigned_engineer_id, status')
        .in('status', ['Open', 'In Progress'])
        .not('assigned_engineer_id', 'is', null)

    if (ticketError) {
      throw ticketError
    }

    // Count active tickets for each engineer
    const workload = {}

    for (const ticket of activeTickets) {
      const engineerId = ticket.assigned_engineer_id

      workload[engineerId] =
        (workload[engineerId] || 0) + 1
    }

    // Combine engineer data with calculated workload
    const results = engineers.map(engineer => {
      const activeCount = workload[engineer.id] || 0

      const remainingCapacity = Math.max(
        0,
        engineer.max_active_tickets - activeCount
      )

      const utilization = Math.round(
        (activeCount / engineer.max_active_tickets) * 100
      )

      return {
        ...engineer,
        active_tickets: activeCount,
        remaining_capacity: remainingCapacity,
        utilization_percentage: utilization
      }
    })

    return res.json({
      success: true,
      count: results.length,
      engineers: results
    })

  } catch (error) {
    console.error(
      'Engineer API error:',
      error.message
    )

    return res.status(500).json({
      success: false,
      message: 'Unable to retrieve engineers'
    })
  }
})

 // API 5: Explainable engineer recommendations
app.get('/api/tickets/:id/recommendations', async (req, res) => {
  try {
    const ticketId = req.params.id

    const { data: ticket, error: ticketError } =
      await supabase
        .from('tickets')
        .select('id, category, priority, status, assigned_engineer_id')
        .eq('id', ticketId)
        .maybeSingle()

    if (ticketError) throw ticketError

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      })
    }

    if (ticket.status !== 'Open' ||
        ticket.assigned_engineer_id !== null) {
      return res.status(409).json({
        success: false,
        message: 'Ticket is not open and unassigned'
      })
    }

    const { data: engineers, error: engineerError } =
      await supabase
        .from('engineers')
        .select('id, name, skills, max_active_tickets, is_available')

    if (engineerError) throw engineerError

    const { data: activeTickets, error: activeError } =
      await supabase
        .from('tickets')
        .select('assigned_engineer_id')
        .in('status', ['Open', 'In Progress'])
        .not('assigned_engineer_id', 'is', null)

    if (activeError) throw activeError

    const workload = {}

    for (const active of activeTickets) {
      const id = active.assigned_engineer_id
      workload[id] = (workload[id] || 0) + 1
    }

    const engineersWithWorkload = engineers.map(e => ({
      ...e,
      active_tickets: workload[e.id] || 0
    }))

    const recommendations =
      recommendEngineers(ticket, engineersWithWorkload)

    return res.json({
      success: true,
      ticket_id: ticket.id,
      category: ticket.category,
      priority: ticket.priority,
      recommended_engineer: recommendations[0] || null,
      recommendations
    })

  } catch (error) {
    console.error('Recommendation error:', error.message)

    return res.status(500).json({
      success: false,
      message: 'Unable to generate recommendations'
    })
  }
})

 // API 6: Assign a ticket to an engineer
// Local development only until authentication is added
app.post('/api/tickets/:id/assign', async (req, res) => {
  try {
    const ticketId = req.params.id
    const { engineer_id } = req.body ?? {}

    // Validate request information
    if (
      !/^SR-\d+$/.test(ticketId) ||
      typeof engineer_id !== 'string' ||
      !/^ENG-\d+$/.test(engineer_id)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ticket or engineer ID'
      })
    }

    // Execute PostgreSQL assignment function
    const { data, error } = await supabase.rpc(
      'assign_ticket',
      {
        p_ticket_id: ticketId,
        p_engineer_id: engineer_id
      }
    )

    if (error) {
      console.error('Assignment error:', error.message)

      // Expected business-rule failures
      const allowedMessages = [
        'Engineer not found',
        'Ticket not found',
        'Ticket is not open and unassigned',
        'Engineer is unavailable',
        'Engineer lacks the required skill',
        'Engineer capacity is full'
      ]

      if (
        error.code === 'P0001' &&
        allowedMessages.includes(error.message)
      ) {
        return res.status(409).json({
          success: false,
          message: error.message
        })
      }

      return res.status(500).json({
        success: false,
        message: 'Unable to assign ticket'
      })
    }

    const assignedTicket = Array.isArray(data)
      ? data[0]
      : data

    if (!assignedTicket) {
      return res.status(500).json({
        success: false,
        message: 'No assignment result returned'
      })
    }

    return res.json({
      success: true,
      message: 'Ticket assigned successfully',
      ticket: assignedTicket
    })

  } catch (error) {
    console.error('Assignment API error:', error.message)

    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
})

 // API 7: Resolve an assigned support ticket
// Local development only until authentication is implemented
app.patch('/api/tickets/:id/resolve', async (req, res) => {
  try {
    const ticketId = req.params.id

    if (!/^SR-\d+$/.test(ticketId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ticket ID'
      })
    }

    // Only assigned, In Progress tickets can be resolved
    const { data, error } = await supabase
      .from('tickets')
      .update({
        status: 'Resolved'
      })
      .eq('id', ticketId)
      .eq('status', 'In Progress')
      .not('assigned_engineer_id', 'is', null)
      .select('id, title, status, assigned_engineer_id')
      .maybeSingle()

    if (error) {
      console.error('Resolution error:', error.message)

      return res.status(500).json({
        success: false,
        message: 'Unable to resolve ticket'
      })
    }

    if (!data) {
      return res.status(409).json({
        success: false,
        message: 'Ticket is not assigned and In Progress, or does not exist'
      })
    }

    return res.json({
      success: true,
      message: 'Ticket resolved successfully',
      ticket: data
    })

  } catch (error) {
    console.error('Resolve API error:', error.message)

    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
})

 // API 8: Reset demo tickets
// In production, only the authenticated demo administrator can reset.
// In local development, retain the original loopback-only protection.

app.post('/api/demo/reset', async (req, res) => {
  try {
    if (process.env.ENABLE_DEMO_RESET !== 'true') {
      return res.status(403).json({
        success: false,
        message: 'Demo reset is disabled'
      })
    }

    if (process.env.NODE_ENV === 'production') {
      if (req.demoRole !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Only the demo administrator can reset data'
        })
      }
    } else {
      const localAddresses = ['127.0.0.1', '::1', '::ffff:127.0.0.1']
      if (!localAddresses.includes(req.socket.remoteAddress)) {
        return res.status(403).json({
          success: false,
          message: 'Local access only'
        })
      }
    }

    // Require explicit confirmation
    if (req.body?.confirmation !== 'RESET SMARTROUTE DEMO') {
      return res.status(400).json({
        success: false,
        message: 'Reset confirmation required'
      })
    }

    // Execute database reset transaction
    const { data, error } = await supabase.rpc(
      'reset_demo_tickets'
    )

    if (error) {
      console.error('Demo reset error:', error.message)

      return res.status(500).json({
        success: false,
        message: 'Demo reset failed'
      })
    }

    return res.json({
      success: true,
      message: 'Demo tickets cleared successfully',
      deleted_count: data
    })

  } catch (error) {
    console.error('Reset API error:', error.message)

    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
})

/*
 * Serve React frontend in production.
 * During local development, Vite serves the frontend.
 */
if (process.env.NODE_ENV === 'production') {
  const frontendDist = path.join(
    __dirname,
    '..',
    'frontend',
    'dist'
  )

  // Serve React production files
  app.use(express.static(frontendDist))

  // Support React Router page refreshes
  app.use((req, res, next) => {
    if (
      req.method !== 'GET' ||
      req.path === '/api' ||
      req.path.startsWith('/api/')
    ) {
      return next()
    }

    return res.sendFile(
      path.join(frontendDist, 'index.html')
    )
  })
}

// Start Express server
const PORT = process.env.PORT || 5000

app.listen(PORT, () => {
  console.log(
    `SmartRoute Backend Running on http://localhost:${PORT}`
  )
})
