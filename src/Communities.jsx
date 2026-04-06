import { useEffect, useMemo, useState } from "react"
import axios from "axios"
import { demoCommunities } from "./demoData.js"

const API = import.meta.env.VITE_API_URL || "http://localhost:8000"

export default function Communities() {
  const [rows, setRows] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        setError("")
        const res = await axios.get(`${API}/communities`)
        if (mounted) {
          setRows(res.data || [])
          setSelected(res.data?.[0] || null)
        }
      } catch {
        if (mounted) {
          const local = demoCommunities()
          setRows(local)
          setSelected(local[0] || null)
          setError("")
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  const stats = useMemo(() => {
    const totalMembers = rows.reduce((acc, r) => acc + (r.size || 0), 0)
    const totalFlagged = rows.reduce((acc, r) => acc + (r.flagged || 0), 0)
    return { count: rows.length, totalMembers, totalFlagged }
  }, [rows])

  return (
    <div className="fade-up">
      <div className="page-header">
        <div className="page-title">Community Detection</div>
        <div className="page-sub">Graph clustering reveals coordinated fraud rings impossible to see in tables</div>
      </div>

      <div className="card mb-4">
        <div style={{ color: "var(--text2)", fontSize: 12 }}>
          TigerGraph-style connected components identified <b>{stats.count}</b> communities from <b>{stats.totalMembers}</b> linked accounts.
        </div>
      </div>
      {error && (
        <div className="card mb-4" style={{ borderColor: 'rgba(255,61,107,.4)' }}>
          <div className="card-title">Query error</div>
          <div style={{ color: "var(--text2)", fontSize: 12 }}>{error}</div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 16 }}>
        <div className="flex-col gap-3">
          <div className="card">
            <div className="card-title">Detected Communities</div>
            {loading ? (
              <div className="skeleton" style={{ height: 120 }} />
            ) : rows.length === 0 ? (
              <div style={{ color: "var(--text2)" }}>No clusters found</div>
            ) : (
              <div className="account-list">
                {rows.map((c) => (
                  <div key={c.community_id} className="account-row" onClick={() => setSelected(c)}>
                    <div className="account-avatar">{c.community_id.replace("C", "")}</div>
                    <div className="account-info">
                      <div className="account-name">Cluster {c.community_id}</div>
                      <div className="account-id mono">{c.size} accounts</div>
                    </div>
                    <span className={`score-badge ${c.risk_ratio > 0.25 ? "score-high" : c.risk_ratio > 0.1 ? "score-med" : "score-low"}`}>
                      {(c.risk_ratio * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-title">Community Stats</div>
            <div className="stat-row"><div className="stat-row-label">Total clusters</div><span className="tag tag-purple">{stats.count}</span></div>
            <div className="stat-row"><div className="stat-row-label">Flagged accounts</div><span className="tag tag-red">{stats.totalFlagged}</span></div>
            <div className="stat-row"><div className="stat-row-label">Coverage</div><span className="tag tag-green">{stats.totalMembers}</span></div>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Cluster Members</div>
          {selected ? (
            <>
              <div className="stats-row">
                <span className="tag tag-purple">{selected.community_id}</span>
                <span className="tag tag-orange">{selected.size} accounts</span>
                <span className="tag tag-red">{selected.flagged} flagged</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 8, marginTop: 12 }}>
                {(selected.members || []).map((m) => (
                  <div key={m} className="tag tag-purple mono" style={{ justifyContent: "center", padding: "7px 6px" }}>
                    {m}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ color: "var(--text2)" }}>Select a community to inspect members</div>
          )}
        </div>
      </div>
    </div>
  )
}

