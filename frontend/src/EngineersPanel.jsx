
import { useEffect, useState } from 'react'

function EngineersPanel() {
  const [engineers, setEngineers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    async function loadEngineers() {
      setLoading(true)
      setError('')

      try {
        const response = await fetch(
          'http://localhost:5000/api/engineers',
          { signal: controller.signal }
        )

        if (!response.ok) {
          throw new Error('Unable to fetch engineers')
        }

        const data = await response.json()

        if (!data.success || !Array.isArray(data.engineers)) {
          throw new Error('Invalid engineer data')
        }

        setEngineers(data.engineers)

      } catch (err) {
        if (err.name !== 'AbortError') {
          setError(err.message)
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    loadEngineers()

    return () => controller.abort()
  }, [reloadKey])

  return (
    <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-slate-900">
            Engineer Management
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            Monitor team skills, capacity and workload
          </p>
        </div>

        <button
          type="button"
          onClick={() => setReloadKey(key => key + 1)}
          disabled={loading}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Refresh Engineers'}
        </button>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-red-700">
          {error}
        </p>
      )}

      {!loading && engineers.length === 0 && !error && (
        <p className="text-slate-500">No engineers available.</p>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {engineers.map(engineer => {
          const utilization = Math.max(
            0,
            Math.min(100, engineer.utilization_percentage)
          )

          const atCapacity = engineer.remaining_capacity === 0

          return (
            <div
              key={engineer.id}
              className="rounded-xl border border-slate-200 p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-lg font-semibold">
                    {engineer.name}
                  </h4>

                  <p className="text-xs text-slate-500">
                    {engineer.id}
                  </p>
                </div>

                <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                  !engineer.is_available || atCapacity
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-green-100 text-green-700'
                }`}>
                  {!engineer.is_available
                    ? 'Unavailable'
                    : atCapacity
                      ? 'At Capacity'
                      : 'Available'}
                </span>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {engineer.skills.map(skill => (
                  <span
                    key={skill}
                    className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700"
                  >
                    {skill}
                  </span>
                ))}
              </div>

              <div className="mt-6 flex justify-between text-sm">
                <span className="text-slate-500">
                  Active Workload
                </span>

                <span className="font-semibold">
                  {engineer.active_tickets} / {engineer.max_active_tickets}
                </span>
              </div>

              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full ${
                    utilization >= 100
                      ? 'bg-red-500'
                      : utilization >= 70
                        ? 'bg-amber-500'
                        : 'bg-indigo-600'
                  }`}
                  style={{ width: `${utilization}%` }}
                />
              </div>

              <p className="mt-3 text-xs text-slate-500">
                Utilization: {engineer.utilization_percentage}%
              </p>

              <p className="mt-1 text-xs text-slate-500">
                Remaining capacity: {engineer.remaining_capacity}
              </p>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export default EngineersPanel
