import { useEffect, useRef, useState } from 'react'
import Dashboard from './Dashboard.jsx'
import Investigate from './Investigate.jsx'
import GraphVisualization from './GraphVisualization.jsx'
import Communities from './Communities.jsx'
import Timeline from './Timeline.jsx'

function App() {
  const [page, setPage] = useState('dashboard')
  const [selectedAccount, setSelectedAccount] = useState(null)
  const [dataMode, setDataMode] = useState('checking')
  const [healthReason, setHealthReason] = useState('')
  const [missingEnv, setMissingEnv] = useState([])
  const [demoRunning, setDemoRunning] = useState(false)
  const demoTimers = useRef([])

  const navigate = (targetPage, accountId = null) => {
    if (accountId) setSelectedAccount(accountId)
    setPage(targetPage)
  }

  useEffect(() => {
    let mounted = true
    const checkHealth = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/health`)
        if (!res.ok) throw new Error('health endpoint unavailable')
        const json = await res.json()
        if (!mounted) return
        setDataMode(json.tigergraph_connected ? 'tigergraph' : 'demo')
        setHealthReason(json.reason || '')
        setMissingEnv(json.missing_env || [])
      } catch {
        if (mounted) setDataMode('offline')
      }
    }
    checkHealth()
    const interval = setInterval(checkHealth, 15000)
    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [])

  const clearDemoTimers = () => {
    for (const t of demoTimers.current) clearTimeout(t)
    demoTimers.current = []
  }

  const runJudgeDemo = () => {
    clearDemoTimers()
    setDemoRunning(true)
    const steps = [
      { at: 0, action: () => navigate('dashboard') },
      { at: 3500, action: () => navigate('investigate', 'ACC00007') },
      { at: 8000, action: () => navigate('visualize', 'ACC00007') },
      { at: 12000, action: () => navigate('communities') },
      { at: 15500, action: () => navigate('timeline') },
      { at: 19000, action: () => { navigate('dashboard'); setDemoRunning(false) } }
    ]
    for (const step of steps) {
      const timer = setTimeout(step.action, step.at)
      demoTimers.current.push(timer)
    }
  }

  const renderPage = () => {
    if (page === 'dashboard') {
      return (
        <Dashboard
          onInvestigate={(id) => navigate('investigate', id)}
          onVisualize={(id) => navigate('visualize', id)}
          onRunDemo={runJudgeDemo}
          demoRunning={demoRunning}
        />
      )
    }

    if (page === 'investigate') {
      return (
        <Investigate initialAccount={selectedAccount} />
      )
    }

    if (page === 'visualize') {
      return (
        <GraphVisualization accountId={selectedAccount} />
      )
    }

    if (page === 'communities') return <Communities />
    if (page === 'timeline') return <Timeline />
  }

  return (
    <div className="app-container">
      <nav className="nav">
        <div className="nav-brand" onClick={() => navigate('dashboard')}>
          <div className="nav-icon">⬡</div>
          <div>
            <div className="nav-title">FraudGraph</div>
            <div className="nav-sub">TigerGraph × IIT Delhi Hackathon</div>
          </div>
        </div>

        <div className="nav-links">
          <button
            className={`nav-link ${page === 'dashboard' ? 'active' : ''}`}
            onClick={() => navigate('dashboard')}
          >
            Dashboard
          </button>

          <button
            className={`nav-link ${page === 'investigate' ? 'active' : ''}`}
            onClick={() => navigate('investigate')}
          >
            Investigate
          </button>

          <button
            className={`nav-link ${page === 'visualize' ? 'active' : ''}`}
            onClick={() => navigate('visualize')}
          >
            Live Graph
          </button>

          <button
            className={`nav-link ${page === 'communities' ? 'active' : ''}`}
            onClick={() => navigate('communities')}
          >
            Communities
          </button>

          <button
            className={`nav-link ${page === 'timeline' ? 'active' : ''}`}
            onClick={() => navigate('timeline')}
          >
            Timeline
          </button>
        </div>

        <div className={`nav-badge ${dataMode === 'tigergraph' ? 'ok' : dataMode === 'demo' ? 'warn' : 'err'}`}>
          {dataMode === 'tigergraph' ? 'TG LIVE' : dataMode === 'demo' ? 'DEMO MODE' : 'BACKEND OFF'}
        </div>
      </nav>

      {dataMode === 'demo' && (
        <div className="card" style={{ margin: '12px 32px 0', borderColor: 'rgba(255,179,71,.5)' }}>
          <div className="card-title">TigerGraph is recommended</div>
          <div style={{ color: 'var(--text2)', fontSize: 12 }}>
            Backend is running with demo fallback.
            {healthReason ? ` TigerGraph reason: ${healthReason}.` : ''}
            {missingEnv.length > 0 ? ` Missing: ${missingEnv.join(', ')}.` : ''}
            {' '}Run `setup_tigergraph_env.bat` and restart backend to switch to TG LIVE.
          </div>
        </div>
      )}

      <main className="main">{renderPage()}</main>
    </div>
  )
}

export default App