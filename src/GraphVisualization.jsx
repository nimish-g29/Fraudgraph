import { useEffect, useState, useRef } from "react"
import ForceGraph2D from "react-force-graph-2d"
import { demoGraphResponse } from "./demoData.js"

const API = import.meta.env.VITE_API_URL || "http://localhost:8000"

export default function GraphVisualization({ accountId }) {
  const fgRef = useRef()

  const [data, setData] = useState({ nodes: [], links: [] })
  const [path, setPath] = useState(new Set())
  const [hoverNode, setHoverNode] = useState(null)
  const [filter, setFilter] = useState("all")
  const [focus, setFocus] = useState(accountId || null)
  const [error, setError] = useState("")
  const [dimensions, setDimensions] = useState({
    width: Math.max(860, window.innerWidth - 160),
    height: 560
  })

  useEffect(() => {
    fetchGraph()

    const interval = setInterval(fetchGraph, 6000)

    const handleResize = () => {
      setDimensions({
        width: Math.max(860, window.innerWidth - 160),
        height: 560
      })
    }

    window.addEventListener("resize", handleResize)

    return () => {
      clearInterval(interval)
      window.removeEventListener("resize", handleResize)
    }
  }, [])

  useEffect(() => {
    setFocus(accountId || null)
  }, [accountId])

  const fetchGraph = async () => {
    try {
      setError("")
      const res = await fetch(`${API}/graph`)
      if (!res.ok) throw new Error("graph endpoint unavailable")
      const json = await res.json()

      const flaggedSet = new Set()
      for (const n of json.nodes || []) {
        if ((n.risk || 0) >= 70) flaggedSet.add(n.id)
      }

      setData({
        nodes: (json.nodes || []).map((n) => ({
          ...n,
          isFlagged: (n.risk || 0) >= 70,
          isFocus: focus ? n.id === focus : false
        })),
        links: (json.edges || []).map((e) => ({
          source: e.source,
          target: e.target,
          hot: flaggedSet.has(e.source) || flaggedSet.has(e.target)
        }))
      })
    } catch {
      const json = demoGraphResponse()
      const flaggedSet = new Set()
      for (const n of json.nodes || []) {
        if ((n.risk || 0) >= 70) flaggedSet.add(n.id)
      }
      setData({
        nodes: (json.nodes || []).map((n) => ({
          ...n,
          isFlagged: (n.risk || 0) >= 70,
          isFocus: focus ? n.id === focus : false
        })),
        links: (json.edges || []).map((e) => ({
          source: e.source,
          target: e.target,
          hot: flaggedSet.has(e.source) || flaggedSet.has(e.target)
        }))
      })
      setError("")
    }
  }

  const getColor = (risk) => {
    if (risk > 70) return "#ff3b3b"
    if (risk > 40) return "#ffaa00"
    return "#3d8bff"
  }

  const handleTrace = async (node) => {
    try {
      // Lightweight local trace: highlight direct neighbors for this node.
      const pathSet = new Set()
      for (const l of data.links) {
        const a = l.source.id || l.source
        const b = l.target.id || l.target
        if (a === node.id || b === node.id) {
          pathSet.add(`${a}-${b}`)
          pathSet.add(`${b}-${a}`)
        }
      }
      setPath(pathSet)
    } catch {}
  }

  const isInPath = (a, b) => {
    return path.has(`${a}-${b}`)
  }

  const filtered = {
    nodes:
      filter === "flagged"
        ? data.nodes.filter((n) => (n.risk || 0) >= 70)
        : data.nodes,
    links:
      filter === "flagged"
        ? data.links.filter((l) => l.hot)
        : data.links
  }

  const txApprox = filtered.links.length * 3

  return (
    <div className="fade-up">
      <div className="page-header">
        <div className="page-title">Live Force Graph</div>
        <div className="page-sub">Real-time transaction network - click nodes to trace suspicious paths</div>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        <button className={`btn btn-sm ${filter === "all" ? "btn-primary" : "btn-ghost"}`} onClick={() => setFilter("all")}>All Accounts</button>
        <button className={`btn btn-sm ${filter === "flagged" ? "btn-primary" : "btn-ghost"}`} onClick={() => setFilter("flagged")}>Fraud Rings Only</button>
        <button className="btn btn-sm btn-ghost" onClick={() => fetchGraph()}>Refresh</button>
        <button className="btn btn-sm btn-ghost" onClick={() => setPath(new Set())}>Clear Trace</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 16 }}>
        <div className="graph-container" style={{ height: 560 }}>
          {error ? (
            <div style={{height:'100%',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text2)',padding:20,textAlign:'center'}}>
              {error}
            </div>
          ) : (
          <ForceGraph2D
            ref={fgRef}
            width={dimensions.width}
            height={dimensions.height}
            graphData={filtered}
            backgroundColor="#05070d"
            nodeRelSize={6}
            nodeCanvasObject={(node, ctx, scale) => {
              const size = node.id === focus ? 8 : 6
              ctx.beginPath()
              ctx.arc(node.x, node.y, size, 0, 2 * Math.PI)
              ctx.fillStyle = node.id === focus ? "#9b6dff" : getColor(node.risk)
              ctx.fill()
              if ((node.risk || 0) > 70) {
                ctx.strokeStyle = "#ff3d6b"
                ctx.lineWidth = 1.5
                ctx.stroke()
              }
              if (scale > 1.45) {
                ctx.font = `${12 / scale}px Sans-Serif`
                ctx.fillStyle = "#ffffff"
                ctx.fillText(node.id, node.x + 8, node.y + 4)
              }
            }}
            linkColor={(link) => {
              const a = link.source.id || link.source
              const b = link.target.id || link.target
              return isInPath(a, b) ? "#00ffff" : "rgba(255,255,255,0.1)"
            }}
            linkWidth={(link) => {
              const a = link.source.id || link.source
              const b = link.target.id || link.target
              return isInPath(a, b) ? 3 : 1
            }}
            linkDirectionalParticles={(link) => {
              const a = link.source.id || link.source
              const b = link.target.id || link.target
              return isInPath(a, b) ? 4 : 0
            }}
            linkDirectionalParticleSpeed={0.004}
            onNodeClick={(node) => {
              handleTrace(node)
              setFocus(node.id)
              if (fgRef.current) {
                fgRef.current.centerAt(node.x, node.y, 600)
                fgRef.current.zoom(2.2, 600)
              }
            }}
            onNodeHover={(node) => setHoverNode(node || null)}
          />
          )}
        </div>
        <div className="flex-col gap-3">
          <div className="card">
            <div className="card-title">Live Snapshot</div>
            <div className="stat-row"><div className="stat-row-label">Accounts</div><span className="tag tag-purple">{filtered.nodes.length}</span></div>
            <div className="stat-row"><div className="stat-row-label">Connections</div><span className="tag tag-orange">{filtered.links.length}</span></div>
            <div className="stat-row"><div className="stat-row-label">Transactions (est.)</div><span className="tag tag-green">{txApprox}</span></div>
          </div>
          <div className="card">
            <div className="card-title">Hover node</div>
            {hoverNode ? (
              <>
                <div className="mono">{hoverNode.id}</div>
                <div className={`score-badge ${(hoverNode.risk || 0) >= 70 ? "score-high" : (hoverNode.risk || 0) >= 40 ? "score-med" : "score-low"}`}>
                  Risk {(hoverNode.risk || 0).toFixed(1)}
                </div>
              </>
            ) : (
              <div style={{ color: "var(--text2)", fontSize: 12 }}>Hover nodes, click to investigate</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}