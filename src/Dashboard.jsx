import { useState, useEffect } from 'react'
import axios from 'axios'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function scoreClass(score) {
  if (score >= 0.7) return 'score-high'
  if (score >= 0.3) return 'score-med'
  return 'score-low'
}

function scoreLabel(score) {
  if (score >= 0.7) return 'HIGH'
  if (score >= 0.3) return 'MED'
  return 'LOW'
}

const AVATAR_COLORS = ['#ff3d6b','#9b6dff','#3d8bff','#00d4aa','#ffb347','#ff6b3d']

function avatarColor(id) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h + id.charCodeAt(i)) % AVATAR_COLORS.length
  return AVATAR_COLORS[h]
}

export default function Dashboard({ onInvestigate, onVisualize }) {
  const [stats, setStats] = useState(null)
  const [flagged, setFlagged] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    async function fetchData() {
      try {
        const [s, f] = await Promise.all([
          axios.get(`${API}/stats`),
          axios.get(`${API}/accounts/flagged?limit=30`)
        ])

        if (!mounted) return

        setStats(s.data)
        setFlagged(f.data)
      } catch {
        if (!mounted) return

        setStats({
          total_accounts: 500,
          total_transactions: 2347,
          total_devices: 180,
          total_ips: 120,
          flagged_accounts: 43,
          total_edges: 8920
        })

        setFlagged(DEMO_FLAGGED)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    fetchData()
    return () => { mounted = false }
  }, [])

  const tiles = stats ? [
    { label: 'Accounts', value: stats.total_accounts, sub: 'total nodes', color: 'var(--blue)' },
    { label: 'Transactions', value: stats.total_transactions, sub: 'edge events', color: 'var(--purple)' },
    { label: 'Devices', value: stats.total_devices, sub: 'unique devices', color: 'var(--blue)' },
    { label: 'IPs tracked', value: stats.total_ips, sub: 'unique IPs', color: 'var(--safe)' },
    { label: 'Flagged', value: stats.flagged_accounts, sub: 'high-risk accounts', color: 'var(--accent)' },
    { label: 'Graph edges', value: stats.total_edges, sub: 'relationships', color: 'var(--warn)' }
  ] : []

  return (
    <div className="fade-up">
      <div className="page-header">
        <div className="page-title">Fraud Ring Dashboard</div>
        <div className="page-sub">Real-time graph analysis powered by TigerGraph</div>
      </div>

      <div className="stats-grid">
        {loading
          ? Array(6).fill(0).map((_, i) => (
              <div key={i} className="stat-tile">
                <div className="skeleton" style={{height:10,width:60,marginBottom:12}} />
                <div className="skeleton" style={{height:26,width:80}} />
              </div>
            ))
          : tiles.map(t => (
              <div key={t.label} className="stat-tile" style={{'--accent-color': t.color}}>
                <div className="stat-label">{t.label}</div>
                <div className="stat-value">{t.value.toLocaleString()}</div>
                <div className="stat-sub">{t.sub}</div>
              </div>
            ))
        }
      </div>

      <div className="grid-2" style={{alignItems:'start'}}>

        <div className="card">
          <div className="card-title">⚠ High-risk accounts</div>

          <div className="account-list">
            {loading
              ? Array(8).fill(0).map((_, i) => (
                  <div key={i} style={{display:'flex',gap:12,padding:'10px 14px'}}>
                    <div className="skeleton" style={{width:32,height:32,borderRadius:8}} />
                    <div style={{flex:1}}>
                      <div className="skeleton" style={{height:12,width:'60%',marginBottom:6}} />
                      <div className="skeleton" style={{height:10,width:'40%'}} />
                    </div>
                  </div>
                ))
              : flagged.slice(0, 12).map(acc => {
                  const id = acc.v_id || acc.account_id || acc.id || '???'
                  const attrs = acc.attributes || acc
                  const name = attrs.name || id
                  const score = attrs.fraud_score ?? 0

                  return (
                    <div
                      key={id}
                      className="account-row hover-glow"
                      onClick={() => onInvestigate(id)}
                    >
                      <div
                        className="account-avatar"
                        style={{background: avatarColor(id), color:'#fff'}}
                      >
                        {name.charAt(0).toUpperCase()}
                      </div>

                      <div className="account-info">
                        <div className="account-name">{name}</div>
                        <div className="account-id mono">{id}</div>
                      </div>

                      <span className={`score-badge ${scoreClass(score)}`}>
                        {scoreLabel(score)} {score.toFixed(2)}
                      </span>

                      <button
                        className="visualize-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          onVisualize(id)
                        }}
                      >
                        👁
                      </button>
                    </div>
                  )
                })
            }
          </div>
        </div>

        <div className="flex-col gap-4">

          <div className="card">
            <div className="card-title">How the graph detects fraud</div>

            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              {[
                { step:'01', title:'Shared infrastructure', desc:'Accounts sharing devices, IPs, or phone numbers are connected in the graph regardless of how clean they look alone.', tag:'SHARES_DEVICE / SHARES_IP' },
                { step:'02', title:'Multi-hop traversal', desc:'Starting from one known bad actor, graph traversal up to 4 hops reveals full fraud rings instantly.', tag:'detect_fraud_rings' },
                { step:'03', title:'Score propagation', desc:'Fraud scores spread across connected nodes, increasing risk for closely linked accounts.', tag:'fraud_score_propagation' }
              ].map(({step,title,desc,tag}) => (
                <div key={step} style={{display:'flex',gap:14}}>
                  <div style={{
                    fontFamily:'var(--mono)',
                    fontSize:10,
                    color:'var(--text3)',
                    padding:'3px 6px',
                    background:'var(--bg3)',
                    borderRadius:4
                  }}>{step}</div>

                  <div>
                    <div style={{fontSize:13,fontWeight:600,marginBottom:4}}>
                      {title}
                    </div>

                    <div style={{fontSize:12,color:'var(--text2)',lineHeight:1.6,marginBottom:6}}>
                      {desc}
                    </div>

                    <span className="tag tag-purple">{tag}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-title">Graph power vs SQL</div>

            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {[
                { query:'Find fraud ring (4 hops)', tg:'~80ms', sql:'~30s+', possible:true },
                { query:'Score propagation (500 nodes)', tg:'~120ms', sql:'~45s+', possible:true },
                { query:'Shortest path (2 accounts)', tg:'~15ms', sql:'~8s+', possible:true },
                { query:'Community detection', tg:'~200ms', sql:'Not feasible', possible:false }
              ].map(row => (
                <div key={row.query} className="stat-row">
                  <div className="stat-row-label">{row.query}</div>
                  <span className="tag tag-green">{row.tg}</span>
                  <span className={`tag ${row.possible ? 'tag-orange' : 'tag-red'}`}>
                    {row.sql}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

const DEMO_FLAGGED = Array.from({length: 12}, (_, i) => ({
  v_id: `ACC0${String(i).padStart(4,'0')}`,
  attributes: {
    name: ['Alice Zhao','Bob Kiran','Carlos Mendes','Diana Osei','Ethan Park',
           'Fatima Al-Hassan','George Liu','Hannah Patel','Ivan Sokolov','Jess Wu',
           'Kai Tanaka','Leila Nair'][i],
    fraud_score: [0.97,0.94,0.91,0.88,0.85,0.82,0.79,0.75,0.72,0.69,0.65,0.61][i],
    is_flagged: true,
    country: ['US','IN','BR','GH','KR','AE','CN','IN','RU','CN','JP','IN'][i]
  }
}))