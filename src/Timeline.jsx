import { useEffect, useMemo, useState } from "react"
import axios from "axios"
import { DEMO_TRANSACTIONS } from "./demoData.js"

const API = import.meta.env.VITE_API_URL || "http://localhost:8000"

function amountLabel(v) {
  return `$${Math.round(v).toLocaleString()}`
}

export default function Timeline() {
  const [rows, setRows] = useState([])
  const [filter, setFilter] = useState("all")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        setError("")
        const res = await axios.get(`${API}/transactions?limit=180`)
        if (mounted) setRows(res.data || [])
      } catch {
        if (mounted) {
          setRows(DEMO_TRANSACTIONS)
          setError("")
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  const filtered = useMemo(() => {
    if (filter === "suspicious") return rows.filter((r) => r.is_fraud)
    if (filter === "large") return rows.filter((r) => r.amount >= 3000)
    return rows
  }, [rows, filter])

  const summary = useMemo(() => {
    const totalVolume = filtered.reduce((acc, r) => acc + r.amount, 0)
    const suspicious = filtered.filter((r) => r.is_fraud)
    const riskyVolume = suspicious.reduce((acc, r) => acc + r.amount, 0)
    return {
      total: filtered.length,
      suspicious: suspicious.length,
      totalVolume,
      riskyVolume,
      top: [...filtered].sort((a, b) => b.amount - a.amount).slice(0, 5)
    }
  }, [filtered])

  const bins = useMemo(() => {
    const ranges = [
      { label: "0-20", min: 0, max: 0.2, cls: "tag-green" },
      { label: "20-40", min: 0.2, max: 0.4, cls: "tag-green" },
      { label: "40-60", min: 0.4, max: 0.6, cls: "tag-orange" },
      { label: "60-80", min: 0.6, max: 0.8, cls: "tag-red" },
      { label: "80-100", min: 0.8, max: 1.0, cls: "tag-red" }
    ]
    return ranges.map((r) => ({
      ...r,
      value: filtered.filter((x) => x.risk_score >= r.min && x.risk_score < r.max).length
    }))
  }, [filtered])

  const maxBin = Math.max(1, ...bins.map((b) => b.value))

  return (
    <div className="fade-up">
      <div className="page-header">
        <div className="page-title">Transaction Timeline</div>
        <div className="page-sub">Live feed of transactions with suspicious activity highlighted</div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button className={`btn btn-sm ${filter === "all" ? "btn-primary" : "btn-ghost"}`} onClick={() => setFilter("all")}>All</button>
          <button className={`btn btn-sm ${filter === "suspicious" ? "btn-primary" : "btn-ghost"}`} onClick={() => setFilter("suspicious")}>Suspicious Only</button>
          <button className={`btn btn-sm ${filter === "large" ? "btn-primary" : "btn-ghost"}`} onClick={() => setFilter("large")}>Large (&gt;$3k)</button>
        </div>
        <button className="btn btn-sm btn-ghost" onClick={() => navigator.clipboard.writeText(JSON.stringify(filtered.slice(0, 20), null, 2))}>
          Export sample
        </button>
      </div>
      {error && (
        <div className="card mb-4" style={{ borderColor: 'rgba(255,61,107,.4)' }}>
          <div className="card-title">Query error</div>
          <div style={{ color: "var(--text2)", fontSize: 12 }}>{error}</div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 16 }}>
        <div className="card" style={{ maxHeight: 520, overflow: "auto" }}>
          <div className="card-title">Showing {filtered.length} rows</div>
          {loading ? (
            <div className="skeleton" style={{ height: 160 }} />
          ) : filtered.length === 0 ? (
            <div style={{ color: "var(--text2)" }}>No transactions match filter</div>
          ) : (
            <div className="account-list">
              {filtered.map((tx) => (
                <div key={tx.tx_id} className="account-row">
                  <div className="account-avatar" style={{ background: tx.is_fraud ? "var(--accent)" : "var(--blue)" }}>
                    {tx.is_fraud ? "!" : "T"}
                  </div>
                  <div className="account-info">
                    <div className="account-name">{tx.sender} → {tx.receiver}</div>
                    <div className="account-id mono">{new Date(tx.timestamp).toLocaleString()}</div>
                  </div>
                  <span className="mono" style={{ minWidth: 76, textAlign: "right" }}>{amountLabel(tx.amount)}</span>
                  <span className={`score-badge ${tx.is_fraud ? "score-high" : tx.risk_score > 0.4 ? "score-med" : "score-low"}`}>
                    {(tx.risk_score * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex-col gap-3">
          <div className="card">
            <div className="card-title">Transaction Summary</div>
            <div className="stats-grid" style={{ gridTemplateColumns: "1fr 1fr", marginBottom: 0 }}>
              <div className="stat-tile"><div className="stat-label">Total</div><div className="stat-value">{summary.total}</div></div>
              <div className="stat-tile"><div className="stat-label">Suspicious</div><div className="stat-value">{summary.suspicious}</div></div>
              <div className="stat-tile"><div className="stat-label">Total Vol</div><div className="stat-value">{amountLabel(summary.totalVolume)}</div></div>
              <div className="stat-tile"><div className="stat-label">Risk Vol</div><div className="stat-value">{amountLabel(summary.riskyVolume)}</div></div>
            </div>
          </div>

          <div className="card">
            <div className="card-title">Top Suspicious Amounts</div>
            <div className="account-list">
              {summary.top.map((tx) => (
                <div key={tx.tx_id} className="stat-row">
                  <div className="stat-row-label mono">{tx.tx_id}</div>
                  <span className="tag tag-red">{amountLabel(tx.amount)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-title">Risk Distribution</div>
            <div className="account-list">
              {bins.map((b) => (
                <div key={b.label} className="stat-row">
                  <div className="stat-row-label mono">{b.label}%</div>
                  <div style={{display:'flex',alignItems:'center',gap:8,flex:1}}>
                    <div style={{height:6,flex:1,background:'var(--bg3)',borderRadius:8,overflow:'hidden'}}>
                      <div style={{height:'100%',width:`${(b.value/maxBin)*100}%`,background:b.cls.includes('red')?'var(--accent)':b.cls.includes('orange')?'var(--warn)':'var(--safe)'}} />
                    </div>
                    <span className={`tag ${b.cls}`}>{b.value}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
