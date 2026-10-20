
import { useEffect, useState } from 'react'

function BackendStatus() {
  const [status, setStatus] = useState('Checking...')

  useEffect(() => {
    fetch('http://localhost:5000/api/health')
      .then(response => {
        if (!response.ok) {
          throw new Error('Backend is unavailable')
        }

        return response.json()
      })
      .then(data => {
        if (data.status === 'ok') {
          setStatus('Connected')
        } else {
          setStatus('Disconnected')
        }
      })
      .catch(() => {
        setStatus('Disconnected')
      })
  }, [])

  return (
    <div className="mb-6 flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <h3 className="font-semibold text-slate-800">
          Backend API
        </h3>
        <p className="text-sm text-slate-500">
          SmartRoute Server Connection
        </p>
      </div>

      <span className={
        status === 'Connected'
          ? 'rounded-full bg-green-100 px-4 py-2 text-sm font-medium text-green-700'
          : 'rounded-full bg-amber-100 px-4 py-2 text-sm font-medium text-amber-700'
      }>
        {status}
      </span>
    </div>
  )
}

export default BackendStatus
