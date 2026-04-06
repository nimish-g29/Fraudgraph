import { useEffect, useState, useRef } from "react"
import ForceGraph2D from "react-force-graph-2d"

export default function GraphVisualization() {
  const fgRef = useRef()

  const [data, setData] = useState({ nodes: [], links: [] })
  const [path, setPath] = useState(new Set())
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  })

  useEffect(() => {
    fetchGraph()

    const interval = setInterval(fetchGraph, 2000)

    const handleResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight
      })
    }

    window.addEventListener("resize", handleResize)

    return () => {
      clearInterval(interval)
      window.removeEventListener("resize", handleResize)
    }
  }, [])

  const fetchGraph = async () => {
    try {
      const res = await fetch("http://localhost:8000/graph")
      const json = await res.json()

      setData({
        nodes: json.nodes,
        links: json.edges.map(([a, b]) => ({
          source: a,
          target: b
        }))
      })
    } catch {
      console.log("Backend not running?")
    }
  }

  const getColor = (risk) => {
    if (risk > 70) return "#ff3b3b"
    if (risk > 40) return "#ffaa00"
    return "#00ff88"
  }

  const handleTrace = async (node) => {
    try {
      const res = await fetch(`http://localhost:8000/trace/${node.id}`)
      const json = await res.json()

      const pathSet = new Set()

      for (let i = 0; i < json.path.length - 1; i++) {
        const a = json.path[i]
        const b = json.path[i + 1]
        pathSet.add(`${a}-${b}`)
        pathSet.add(`${b}-${a}`)
      }

      setPath(pathSet)
    } catch {}
  }

  const isInPath = (a, b) => {
    return path.has(`${a}-${b}`)
  }

  return (
    <div style={{ height: "100vh", width: "100%", position: "relative" }}>

      {/* CONTROLS */}
      <div className="graph-controls">
        <button onClick={() => fetch("http://localhost:8000/scenario/ring")}>Ring</button>
        <button onClick={() => fetch("http://localhost:8000/scenario/cluster")}>Cluster</button>
        <button onClick={() => fetch("http://localhost:8000/scenario/attack")}>Attack</button>

        <div className="divider" />

        <button onClick={() => fetch("http://localhost:8000/mode/normal")}>Normal</button>
        <button onClick={() => fetch("http://localhost:8000/mode/attack")}>Attack</button>
      </div>

      {/* GRAPH */}
      <ForceGraph2D
        ref={fgRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={data}
        backgroundColor="#05070d"

        nodeRelSize={6}

        nodeCanvasObject={(node, ctx, scale) => {
          const size = 6

          ctx.beginPath()
          ctx.arc(node.x, node.y, size, 0, 2 * Math.PI)
          ctx.fillStyle = getColor(node.risk)
          ctx.fill()

          ctx.shadowBlur = 15
          ctx.shadowColor = getColor(node.risk)

          if (scale > 1.5) {
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

          if (fgRef.current) {
            fgRef.current.centerAt(node.x, node.y, 600)
            fgRef.current.zoom(3, 600)
          }
        }}
      />
    </div>
  )
}