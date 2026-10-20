
import { useState } from 'react'

function SmartAssignment({ tickets, onAssigned }) {
  const [selectedId, setSelectedId] = useState('')
  const [recommendations, setRecommendations] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searchedTicket, setSearchedTicket] = useState('')
  const [assigningId, setAssigningId] = useState('')
  const [success, setSuccess] = useState('')

  // Only open tickets are eligible for assignment.
  const openTickets = tickets.filter(
    ticket => ticket.status === 'Open'
  )

  async function findRecommendations(event) {
    event.preventDefault()

    if (!selectedId || loading) return

    setLoading(true)
    setError('')
    setRecommendations([])
    setSearchedTicket('')

    try {
      const response = await fetch(
        `http://localhost:5000/api/tickets/${encodeURIComponent(selectedId)}/recommendations`
      )

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || 'Recommendation failed'
        )
      }

      setRecommendations(data.recommendations)
      setSearchedTicket(data.ticket_id)

    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }
  async function assignEngineer(engineer) {
  if (!searchedTicket || assigningId) return

  const confirmed = window.confirm(
    `Assign ticket ${searchedTicket} to ${engineer.name}?`
  )

  if (!confirmed) return

  setAssigningId(engineer.engineer_id)
  setError('')
  setSuccess('')

  try {
    const response = await fetch(
      `http://localhost:5000/api/tickets/${encodeURIComponent(searchedTicket)}/assign`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          engineer_id: engineer.engineer_id
        })
      }
    )

    const data = await response.json()

    if (!response.ok || !data.success) {
      throw new Error(
        data.message || 'Unable to assign ticket'
      )
    }

    // Update the parent dashboard
    onAssigned(data.ticket)

    setSuccess(
      `Ticket ${searchedTicket} successfully assigned to ${engineer.name}!`
    )

    // Clear recommendations after assignment
    setRecommendations([])
    setSearchedTicket('')
    setSelectedId('')

  } catch (err) {
    setError(err.message)
  } finally {
    setAssigningId('')
  }
}
  return (
    <section className="mb-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">

      <div className="mb-6">
        <h3 className="text-xl font-bold text-slate-900">
          Smart Engineer Assignment
        </h3>

        <p className="mt-1 text-sm text-slate-500">
          Explainable, skill-based and workload-aware recommendations
        </p>
      </div>

      <form
        onSubmit={findRecommendations}
        className="flex flex-wrap items-end gap-4"
      >
        <div className="min-w-60 flex-1">
          <label
            htmlFor="assignment-ticket"
            className="mb-2 block text-sm font-medium"
          >
            Select an open ticket
          </label>

          <select
            id="assignment-ticket"
            value={selectedId}
            onChange={event => {
              setSelectedId(event.target.value)
              setRecommendations([])
              setSearchedTicket('')
              setError('')
            }}
            className="w-full rounded-lg border border-slate-300 bg-white p-3"
          >
            <option value="">Choose a ticket</option>

            {openTickets.map(ticket => (
              <option key={ticket.id} value={ticket.id}>
                {ticket.id} — {ticket.title}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={!selectedId || loading}
          className="rounded-lg bg-indigo-600 px-5 py-3 font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Analyzing...' : 'Find Best Engineer'}
        </button>
      </form>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      {success && (
        <p
            role="status"
            className="mt-4 rounded-lg bg-green-50 p-4 text-sm font-medium text-green-700"
        >
            {success}
        </p>
     )}

      {searchedTicket && (
        <div className="mt-8">
          <h4 className="mb-4 text-lg font-semibold">
            Recommendations for {searchedTicket}
          </h4>

          {recommendations.length === 0 ? (
            <p className="rounded-lg bg-amber-50 p-4 text-amber-800">
              No eligible engineers available.
            </p>
          ) : (
            <div className="space-y-4">
              {recommendations.map((engineer, index) => (
                <div
                  key={engineer.engineer_id}
                  className="rounded-xl border border-slate-200 p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h5 className="font-semibold text-slate-900">
                        #{index + 1} — {engineer.name}
                      </h5>

                      <p className="text-sm text-slate-500">
                        {engineer.engineer_id}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-2xl font-bold text-indigo-600">
                        {engineer.score}/100
                      </p>

                      {index === 0 && (
                        <span className="text-xs font-medium text-green-700">
                          Top Recommendation
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-indigo-600"
                      style={{
                        width: `${Math.max(0, Math.min(100, engineer.score))}%`
                      }}
                    />
                  </div>

                  <p className="mt-3 text-sm text-slate-500">
                    Workload: {engineer.active_tickets} / {engineer.max_active_tickets} active tickets
                  </p>

                  <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-slate-600">
                    {engineer.explanation.map((reason, i) => (
                      <li key={i}>{reason}</li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => assignEngineer(engineer)}
                    disabled={Boolean(assigningId)}
                    className="mt-5 rounded-lg bg-indigo-600 px-5 py-3 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {assigningId === engineer.engineer_id
                      ? 'Assigning...'
                    : `Assign to ${engineer.name}`}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

export default SmartAssignment
