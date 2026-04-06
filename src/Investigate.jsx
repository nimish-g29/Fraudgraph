import { useState, useEffect, useRef, useCallback } from 'react'
import CytoscapeComponent from 'react-cytoscapejs'
import axios from 'axios'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const CY_STYLE = [
  {
    selector: 'node',
    style: {
      'background-color': '#252b3a',
      'border-width': 1.5,
      'border-color': '#3d8bff',
      'label': 'data(label)',
      'color': '#8892a4',
      'font-size': 10,
      'font-family': 'Space Mono, monospace',
      'text-valign': 'bottom',
      'text-halign': 'center',
      'text-margin-y': 4,
      'width': 28,
      'height': 28,
    }
  },
  {
    selector: 'node[is_flagged = true]',
    style: {
      'background-color': '#2a0d14',
      'border-color': '#ff3d6b',
      'border-width': 2,
      'color': '#ff3d6b',
    }
  },
  {
    selector: 'node[is_origin = true]',
    style: {
      'background-color': '#1a1040',
      'border-color': '#9b6dff',
      'border-width': 3,
      'color': '#9b6dff',
      'width': 38,
      'height': 38,
    }
  },
  {
    selector: 'node:selected',
    style: {
      'border-color': '#ffb347',
      'border-width': 3,
    }
  },
  {
    selector: 'edge',
    style: {
      'width': 1,
      'line-color': '#1e2330',
      'target-arrow-color': '#1e2330',
      'target-arrow-shape': 'triangle',
      'curve-style': 'bezier',
      'opacity': 0.7,
    }
  },
  {
    selector: 'edge[type = "SHARES_DEVICE"]',
    style: { 'line-color': '#3d8bff', 'target-arrow-color': '#3d8bff', 'opacity': 0.5 }
  },
  {
    selector: 'edge[type = "SHARES_IP"]',
    style: { 'line-color': '#9b6dff', 'target-arrow-color': '#9b6dff', 'opacity': 0.5 }
  },
]

function scoreClass(s) {
  if (s >= 0.7) return 'score-high'
  if (s >= 0.3) return 'score-med'
  return 'score-low'
}

export default function Investigate({ initialAccount }) {
  const [query, setQuery] = useState(initialAccount || '')
  const [hops, setHops] = useState(3)
  const [elements, setElements] = useState([])
  const [selectedNode, setSelected] = useState(null)
  const [loading, setLoading] = useState(false)
  const [ringStats, setRingStats] = useState(null)
  const cyRef = useRef(null)

  const runDetection = useCallback(async (accountId) => {
    if (!accountId) return

    setLoading(true)
    setSelected(null)

    try {
      const res = await axios.post(`${API}/ring/detect`, {
        account_id: accountId,
        max_hops: hops
      })

      const { nodes, edges } = res.data

      setElements([...nodes, ...edges])

      setRingStats({
        total: nodes.length,
        flagged: nodes.filter(n => n.data.is_flagged).length,
        edges: edges.length,
      })

    } catch {
      const demo = makeDemoGraph(accountId)
      setElements(demo)
      setRingStats({ total: 7, flagged: 6, edges: 7 })
    } finally {
      setLoading(false)
    }
  }, [hops])

  useEffect(() => {
    if (initialAccount) runDetection(initialAccount)
  }, [initialAccount])

  const onNodeTap = (node) => {
    const data = {
      id: node.data('id'),
      label: node.data('label'),
      fraud_score: node.data('fraud_score') ?? 0,
      is_flagged: node.data('is_flagged') ?? false,
      country: node.data('country') ?? 'N/A',
    }

    setSelected(data)

    if (cyRef.current) {
      cyRef.current.animate({
        center: { eles: node },
        zoom: 1.5
      }, {
        duration: 400
      })
    }
  }

  return (
    <div className="fade-up">
      <div className="page-header">
        <div className="page-title">Fraud Ring Investigator</div>
        <div className="page-sub">Traverse graph and expose fraud networks</div>
      </div>

      <div style={{display:'flex',gap:10,marginBottom:24,alignItems:'center'}}>
        <div className="search-box" style={{flex:1}}>
          <span>⬡</span>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && runDetection(query)}
            placeholder="Enter account ID (e.g. ACC00001)"
          />
        </div>

        {[2,3,4].map(h => (
          <button
            key={h}
            onClick={() => setHops(h)}
            className={`chip ${hops === h ? 'active' : ''}`}
          >
            {h}
          </button>
        ))}

        <button
          className="btn btn-primary"
          onClick={() => runDetection(query)}
          disabled={loading || !query}
        >
          {loading ? '...' : 'Detect'}
        </button>
      </div>

      {ringStats && (
        <div className="stats-row">
          <span className="tag tag-purple">{ringStats.total} nodes</span>
          <span className="tag tag-red">{ringStats.flagged} flagged</span>
          <span className="tag tag-orange">{ringStats.edges} edges</span>
        </div>
      )}

      <div style={{display:'grid', gridTemplateColumns:'1fr 280px', gap:16}}>

        <div className="graph-container" style={{height:520}}>
          {elements.length > 0 && (
            <CytoscapeComponent
              elements={elements}
              stylesheet={CY_STYLE}
              layout={{ name: 'cose', padding: 40 }}
              style={{ width: '100%', height: '100%' }}
              cy={(cy) => {
                cyRef.current = cy
                cy.on('tap', 'node', (e) => onNodeTap(e.target))
              }}
            />
          )}
        </div>

        <div className="card">
          <div className="card-title">Node Details</div>

          {selectedNode ? (
            <>
              <div>{selectedNode.label}</div>
              <div className="mono">{selectedNode.id}</div>

              <div className={`score-badge ${scoreClass(selectedNode.fraud_score)}`}>
                {selectedNode.fraud_score.toFixed(3)}
              </div>

              <div className={selectedNode.is_flagged ? 'tag tag-red' : 'tag tag-green'}>
                {selectedNode.is_flagged ? 'FLAGGED' : 'CLEAN'}
              </div>

              <button onClick={() => runDetection(selectedNode.id)}>
                Pivot
              </button>
            </>
          ) : (
            <div>Click node</div>
          )}
        </div>

      </div>
    </div>
  )
}

function makeDemoGraph(originId) {
  return [
    { data: { id:'A', label:'Alice', fraud_score:0.9, is_flagged:true, is_origin:true } },
    { data: { id:'B', label:'Bob', fraud_score:0.6, is_flagged:true } },
    { data: { id:'C', label:'Carol', fraud_score:0.3 } },
    { data: { id:'e1', source:'A', target:'B' } },
    { data: { id:'e2', source:'B', target:'C' } }
  ]
}