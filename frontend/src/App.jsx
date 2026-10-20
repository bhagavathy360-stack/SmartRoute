import { useState, useEffect } from 'react'
import BackendStatus from './BackendStatus'
import SmartAssignment from './SmartAssignment'
import EngineersPanel from './EngineersPanel'
import { NavLink, useLocation } from 'react-router-dom'
const initialTickets = []
function App() {
  const { pathname } = useLocation()
  const [tickets, setTickets] = useState([])
  const [ticketError, setTicketError] = useState('')  
  const [resolvingId, setResolvingId] = useState('')
  const [resolutionMessage, setResolutionMessage] = useState('')
  const [resolutionError, setResolutionError] = useState('')
  const [isResetting, setIsResetting] = useState(false)
  const [resetMessage, setResetMessage] = useState('')
  const [resetError, setResetError] = useState('')
  const [canResetDemo, setCanResetDemo] = useState(false)

  useEffect(() => {
  let cancelled = false

  async function loadTickets() {
    try {
      const response = await fetch(
        '/api/tickets'
      )

      if (!response.ok) {
        throw new Error('Failed to fetch tickets')
      }

      const data = await response.json()

      if (!data.success || !Array.isArray(data.tickets)) {
        throw new Error('Invalid backend response')
      }

      if (!cancelled) {
        setTickets(data.tickets)
        setTicketError('')
      }

    } catch (error) {
      if (!cancelled) {
        setTicketError(error.message)
      }
    }
  }

  loadTickets()

  return () => {
    cancelled = true
  }
}, [])

  // The server determines whether the signed-in user can reset demo data.
  // Never infer admin rights from a browser-stored username or password.
  useEffect(() => {
    let cancelled = false

    async function loadResetPermission() {
      try {
        const response = await fetch('/api/health', { cache: 'no-store' })
        if (!response.ok) throw new Error('Unable to check reset permission')
        const data = await response.json()
        if (!cancelled) setCanResetDemo(data.can_reset_demo === true)
      } catch {
        if (!cancelled) setCanResetDemo(false)
      }
    }

    loadResetPermission()
    return () => { cancelled = true }
  }, [])

  const [showForm, setShowForm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState({
    title: '',
    category: 'Network',
    priority: 'Medium'
  })

  const openCount = tickets.filter(
    t => t.status === 'Open'
  ).length

  const progressCount = tickets.filter(
    t => t.status === 'In Progress'
  ).length

  const resolvedCount = tickets.filter(
    t => t.status === 'Resolved'
  ).length

  
async function handleCreateTicket(event) {
  event.preventDefault()

  if (isSubmitting) return

  const title = form.title.trim()

  if (!title) {
    alert('Please enter a ticket description')
    return
  }

  setIsSubmitting(true)

  try {
    // Send ticket data to Express backend
    const response = await fetch(
      '/api/tickets',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title,
          category: form.category,
          priority: form.priority
        })
      }
    )

    const data = await response.json()

    if (!response.ok || !data.success) {
      throw new Error(
        data.message || 'Failed to create ticket'
      )
    }

    // Use the ticket returned by the backend
    setTickets(current => [
      data.ticket,
      ...current
    ])

    // Reset form
    setForm({
      title: '',
      category: 'Network',
      priority: 'Medium'
    })

    setShowForm(false)

    alert('Ticket created successfully!')

  } catch (error) {
    alert('Error: ' + error.message)
  } finally {
    setIsSubmitting(false)
  }
}

function handleTicketAssigned(assignedTicket) {
  setTickets(current =>
    current.map(ticket =>
      ticket.id === assignedTicket.ticket_id
        ? {
            ...ticket,
            status: assignedTicket.status,
            assigned_engineer_id:
              assignedTicket.assigned_engineer_id
          }
        : ticket
    )
  )
}
  
async function handleResolveTicket(ticketId) {
  if (resolvingId) return

  const confirmed = window.confirm(
    `Are you sure you want to resolve ticket ${ticketId}?`
  )

  if (!confirmed) return

  setResolvingId(ticketId)
  setResolutionMessage('')
  setResolutionError('')

  try {
    const response = await fetch(
      `/api/tickets/${encodeURIComponent(ticketId)}/resolve`,
      {
        method: 'PATCH'
      }
    )

    const data = await response.json()

    if (!response.ok || !data.success) {
      throw new Error(
        data.message || 'Failed to resolve ticket'
      )
    }

    // Update ticket status in React
    setTickets(current =>
      current.map(ticket =>
        ticket.id === ticketId
          ? { ...ticket, status: data.ticket.status }
          : ticket
      )
    )

    setResolutionMessage(
      `Ticket ${ticketId} resolved successfully!`
    )

  } catch (error) {
    setResolutionError(error.message)
  } finally {
    setResolvingId('')
  }
}

async function handleResetDemo() {
  if (isResetting) return

  const confirmation = window.prompt(
    'WARNING: This will permanently delete ALL tickets and their assignments from your Supabase database.\n\nType RESET SMARTROUTE DEMO to continue:'
  )

  if (confirmation !== 'RESET SMARTROUTE DEMO') {
    return
  }

  const finalConfirmation = window.confirm(
    'FINAL CONFIRMATION!\n\nDelete ALL demo tickets and reset engineer workloads to zero?'
  )

  if (!finalConfirmation) return

  setIsResetting(true)
  setResetError('')
  setResetMessage('')

  try {
    const response = await fetch(
      '/api/demo/reset',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          confirmation: 'RESET SMARTROUTE DEMO'
        })
      }
    )

    const data = await response.json()

    if (!response.ok || !data.success) {
      throw new Error(
        data.message || 'Demo reset failed'
      )
    }

    // Clear React ticket state
    setTickets([])
    setShowForm(false)

    // Clear previous resolution messages
    setResolutionMessage('')
    setResolutionError('')

    setResetMessage(
      `Demo reset completed! ${data.deleted_count} tickets deleted. Engineer profiles preserved.`
    )

  } catch (error) {
    setResetError(error.message)
  } finally {
    setIsResetting(false)
  }
}


  const stats = [
    { label: 'Total Tickets', value: tickets.length },
    { label: 'Open Tickets', value: openCount },
    { label: 'In Progress', value: progressCount },
    { label: 'Resolved', value: resolvedCount }
  ]

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex min-h-screen">

        {/* Sidebar */}
        <aside className="hidden w-64 shrink-0 bg-slate-950 p-6 text-white md:block">
          <h1 className="text-2xl font-bold text-indigo-400">
            SmartRoute
          </h1>

          <p className="mt-1 text-xs text-slate-400">
            IT Support Management
          </p>
          <nav className="mt-12 space-y-2">
            {[
              { label: 'Dashboard', path: '/dashboard' },
              { label: 'Ticket Management', path: '/tickets' },
              { label: 'Smart Assignment', path: '/smart-assignment' },
              { label: 'Engineers', path: '/engineers' }
            ].map(item => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `block rounded-lg px-4 py-3 text-sm transition-colors ${
                    isActive
                      ? 'bg-indigo-600 font-semibold text-white'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="min-w-0 flex-1 p-6 md:p-10">
        {pathname !== '/engineers' && (
          <>
          <header className="mb-10 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-3xl font-bold">
                {pathname === '/smart-assignment'
                  ? 'Smart Assignment'
                  : pathname === '/tickets'
                    ? 'Ticket Management'
                    : 'Dashboard'}
              </h2>
              <p className="mt-2 text-slate-500">
                Welcome to SmartRoute IT Support
              </p>
            </div>

            {pathname === '/tickets' && (
            <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="rounded-lg bg-indigo-600 px-5 py-3 font-medium text-white hover:bg-indigo-700"
            >
              + Create New Ticket
            </button>
            {canResetDemo && (
                <button
                  type="button"
                  onClick={handleResetDemo}
                  disabled={isResetting}
                  className="rounded-lg border border-red-300 bg-red-50 px-5 py-3 font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                >
                  {isResetting
                    ? 'Resetting...'
                    : 'Reset Demo Data'}
                </button>
              )}
              </div>
        )}
          </header>

          {/* Ticket Creation Form */}
          {pathname === '/tickets' && showForm && (
            <section className="mb-8 rounded-xl border border-indigo-200 bg-white p-6 shadow-sm">
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-xl font-bold">
                  Create Support Ticket
                </h3>

                <button
                  onClick={() => setShowForm(false)}
                  className="text-sm text-slate-500 hover:text-red-600"
                >
                  Cancel
                </button>
              </div>

              <form onSubmit={handleCreateTicket} className="space-y-5">

                <div>
                  <label htmlFor="ticket-title" className="mb-2 block text-sm font-medium">
                    Describe your issue
                  </label>

                  <textarea
                    id="ticket-title"
                    required
                    maxLength={500}
                    rows={3}
                    value={form.title}
                    onChange={e => setForm({
                      ...form,
                      title: e.target.value
                    })}
                    placeholder="Example: Office Wi-Fi is not connecting..."
                    className="w-full rounded-lg border border-slate-300 p-3 outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label htmlFor="ticket-category" className="mb-2 block text-sm font-medium">
                      Category
                    </label>

                    <select
                      id="ticket-category"
                      value={form.category}
                      onChange={e => setForm({
                        ...form,
                        category: e.target.value
                      })}
                      className="w-full rounded-lg border border-slate-300 p-3"
                    >
                      <option>Network</option>
                      <option>Hardware</option>
                      <option>Software</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="ticket-priority" className="mb-2 block text-sm font-medium">
                      Priority
                    </label>

                    <select
                      id="ticket-priority"
                      value={form.priority}
                      onChange={e => setForm({
                        ...form,
                        priority: e.target.value
                      })}
                      className="w-full rounded-lg border border-slate-300 p-3"
                    >
                      <option>Low</option>
                      <option>Medium</option>
                      <option>High</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-indigo-600 px-6 py-3 font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
>
                  {isSubmitting ? 'Submitting...' : 'Submit Ticket'}
                </button>
              </form>
            </section>
          )}
          <BackendStatus />
          {resetMessage && pathname === '/tickets' && (
            <p
              role="status"
              className="mb-4 rounded-lg bg-green-50 p-4 font-medium text-green-700"
            >
              {resetMessage}
            </p>
          )}

          {resetError && pathname === '/tickets' && (
            <p
              role="alert"
              className="mb-4 rounded-lg bg-red-50 p-4 font-medium text-red-700"
            >
              {resetError}
            </p>
          )}

          {resolutionMessage && (
            <p
              role="status"
              className="mb-4 rounded-lg bg-green-50 p-4 font-medium text-green-700"
            >
              {resolutionMessage}
            </p>
          )}

          {resolutionError && (
            <p
              role="alert"
              className="mb-4 rounded-lg bg-red-50 p-4 font-medium text-red-700"
            >
              {resolutionError}
            </p>
          )}
          {pathname === '/smart-assignment' && (
            <SmartAssignment
              tickets={tickets}
              onAssigned={handleTicketAssigned}
            />
          )}
          {ticketError && (
              <p className="mb-4 text-sm text-red-600">
               Unable to load tickets: {ticketError}
              </p>
            )}
          {pathname !== '/smart-assignment' && (
           <>
          {/* Statistics */}
          {pathname === '/dashboard' && (
            <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              {stats.map(stat => (
                <div
                  key={stat.label}
                  className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <p className="text-sm text-slate-500">
                    {stat.label}
                  </p>
                  <h3 className="mt-3 text-4xl font-bold">
                    {stat.value}
                  </h3>
                </div>
              ))}
            </section>
          )}

          {/* Ticket Table */}
          {pathname === '/tickets' && (
          <section className="mt-10 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-6">
              <h3 className="text-xl font-semibold">
                Recent Support Tickets
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Track and manage reported IT issues
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    {['Ticket ID', 'Issue', 'Category', 'Priority', 'Status', 'Action'].map(heading => (
                      <th key={heading} className="px-6 py-4 font-medium">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                {tickets.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-14 text-center">
                      <div className="flex flex-col items-center gap-3">

                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-50">
                          <span className="text-3xl">🎫</span>
                        </div>

                        <h3 className="text-xl font-semibold text-slate-900">
                          No Support Tickets Yet
                        </h3>

                        <p className="max-w-md text-sm text-slate-500">
                          Your workspace is ready! Create your first
                          support ticket to start managing IT issues.
                        </p>

                        <button
                          type="button"
                          onClick={() => setShowForm(true)}
                          className="mt-3 rounded-lg bg-indigo-600 px-5 py-3 font-medium text-white hover:bg-indigo-700"
                        >
                          + Create First Ticket
                        </button>

                      </div>
                    </td>
                  </tr>
                )}

                  {tickets.map(ticket => (
                    <tr key={ticket.id} className="border-t border-slate-100">
                      <td className="px-6 py-4 font-semibold text-indigo-600">
                        {ticket.id}
                      </td>

                      <td className="px-6 py-4">
                        {ticket.title}
                      </td>

                      <td className="px-6 py-4">
                        {ticket.category}
                      </td>

                      <td className="px-6 py-4">
                        <span className={
                          ticket.priority === 'High'
                            ? 'font-semibold text-red-600'
                            : 'text-slate-600'
                        }>
                          {ticket.priority}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
                          {ticket.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                      {ticket.status === 'In Progress' &&
                      ticket.assigned_engineer_id ? (
                        <button
                          type="button"
                          onClick={() => handleResolveTicket(ticket.id)}
                          disabled={Boolean(resolvingId)}
                          className="rounded-lg bg-green-600 px-4 py-2 text-xs font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {resolvingId === ticket.id
                            ? 'Resolving...'
                            : 'Resolve'}
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          )}
          </>
        )}
          </>
        )}
          {pathname === '/engineers' && (
          <>
            <h2 className="text-3xl font-bold text-slate-900">
              Engineers
            </h2>

            <p className="mt-2 text-slate-500">
              Manage your IT support team
            </p>

            <EngineersPanel />
          </>
        )}

          <p className="mt-6 text-sm text-slate-400">
            SmartRoute • Development Preview
          </p>

        </main>
      </div>
    </div>
  )
}

export default App
