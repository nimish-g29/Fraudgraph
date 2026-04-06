import { useState } from 'react'
import Dashboard from './Dashboard.jsx'
import Investigate from './Investigate.jsx'
import GraphVisualization from './GraphVisualization.jsx'

function App() {
  const [page, setPage] = useState('dashboard')
  const [selectedAccount, setSelectedAccount] = useState(null)

  const navigate = (targetPage, accountId = null) => {
    if (accountId) setSelectedAccount(accountId)
    setPage(targetPage)
  }

  const renderPage = () => {
    if (page === 'dashboard') {
      return (
        <Dashboard
          onInvestigate={(id) => navigate('investigate', id)}
          onVisualize={(id) => navigate('visualize', id)}
        />
      )
    }

    if (page === 'investigate') {
      return selectedAccount ? (
        <Investigate initialAccount={selectedAccount} />
      ) : (
        <Dashboard
          onInvestigate={(id) => navigate('investigate', id)}
          onVisualize={(id) => navigate('visualize', id)}
        />
      )
    }

    if (page === 'visualize') {
      return selectedAccount ? (
        <GraphVisualization accountId={selectedAccount} />
      ) : (
        <Dashboard
          onInvestigate={(id) => navigate('investigate', id)}
          onVisualize={(id) => navigate('visualize', id)}
        />
      )
    }
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
            Visualize
          </button>
        </div>

        <div className="nav-badge">LIVE</div>
      </nav>

      <main className="main">{renderPage()}</main>
    </div>
  )
}

export default App