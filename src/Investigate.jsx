import { useState, useEffect, useRef, useCallback } from 'react'
import CytoscapeComponent from 'react-cytoscapejs'
import axios from 'axios'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// ── Cytoscape stylesheet ─────────────────────────────────────────────────────
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

// ── Demo graph elements ──────────────────────────────────────────────────────
function makeDemoGraph(originId) {
  const ring = ['ACC00001','ACC00002','ACC00003','ACC00004','ACC00005']
  const nodes = ring.map((id, i) => ({
    data: {
      id, label: ['Alice Z.','Bob K.','Carlos M.','Diana O.','Ethan P.'][i],
      fraud_score: [0.97, 0.94, 0.88, 0.82, 0.79][i],
      is_flagged: true,
      is_origin: id === originId,
    }
  }))
  nodes.push(
    { data: { id: 'ACC00099', label: 'Innocent?', fraud_score: 0.35, is_flagged: false, is_origin: false } },
    { data: { id: 'ACC00100', label: 'Frank L.', fraud_score: 0.65, is_flagged: true, is_origin: false } },
  )
  const edges = [
    { data: { id:'e1', source:'ACC00001', target:'ACC00002', type:'SHARES_DEVICE' } },
    { data: { id:'e2', source:'ACC00002', target:'ACC00003', type:'SHARES_IP' } },
    { data: { id:'e3', source:'ACC00003', target:'ACC00004', type:'SHARES_DEVICE' } },
    { data: { id:'e4', source:'ACC00004', target:'ACC00005', type:'SHARES_IP' } },
    { data: { id:'e5', source:'ACC00005', target:'ACC00001', type:'SHARES_DEVICE' } },
    { data: { id:'e6', source:'ACC00099', target:'ACC00003', type:'SHARES_IP' } },
    { data: { id:'e7', source:'ACC00100', target:'ACC00002', type:'SHARES_DEVICE' } },
  ]
  return [...nodes, ...edges]
}

function scoreClass(s) {
  if (s >= 0.7) return 'score-high'
  if (s >= 0.3) return 'score-med'
  return 'score-low'
}

// ── Component ────────────────────────────────────────────────────────────────
export default function Investigate({ initialAccount }) {
  const [query, setQuery]           = useState(initialAccount || '')
  const [hops, setHops]             = useState(3)
  const [elements, setElements]     = useState([])
  const [selectedNode, setSelected] = useState(null)
  const [loading, setLoading]       = useState(false)
  const [ringStats, setRingStats]   = useState(null)
  const cyRef = useRef(null)

  const runDetection = useCallback(async (accountId) => {
    if (!accountId) return
    setLoading(true)
    setSelected(null)
    try {
      const res = await axios.post(`${API}/ring/detect`, { account_id: accountId, max_hops: hops })
      const { nodes, edges } = res.data
      setElements([...nodes, ...edges])
      setRingStats({
        total: nodes.length,
        flagged: nodes.filter(n => n.data.is_flagged).length,
        edges: edges.length,
      })
    } catch {
      // Demo fallback
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
    setSelected({
      id:          node.data('id'),
      label:       node.data('label'),
      fraud_score: node.data('fraud_score') ?? 0,
      is_flagged:  node.data('is_flagged') ?? false,
      country:     node.data('country') ?? 'N/A',
    })
  }

  return (
    <div className="fade-up">
      <div className="page-header">
        <div className="page-title">Fraud Ring Investigator</div>
        <div className="page-sub">Enter an account ID to traverse the graph and surface its ring</div>
      </div>

      {/* Search bar */}
      <div style={{display:'flex',gap:10,marginBottom:24,alignItems:'center'}}>
        <div className="search-box" style={{flex:1}}>
          <span style={{fontSize:13,color:'var(--text3)'}}>⬡</span>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && runDetection(query)}
            placeholder="Enter account ID (e.g. ACC00001) or try ACC00042..."
          />
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8,fontSize:12,color:'var(--text2)'}}>
          <span className="mono">hops:</span>
          {[2,3,4].map(h => (
            <button
              key={h}
              onClick={() => setHops(h)}
              style={{
                padding:'4px 10px', borderRadius:6, border:'1px solid',
                fontFamily:'var(--mono)', fontSize:11, cursor:'pointer',
                background: hops === h ? 'var(--accent)' : 'var(--bg3)',
                borderColor: hops === h ? 'var(--accent)' : 'var(--border2)',
                color: hops === h ? '#fff' : 'var(--text2)',
              }}
            >{h}</button>
          ))}
        </div>
        <button
          className="btn btn-primary"
          onClick={() => runDetection(query)}
          disabled={loading || !query}
        >
          {loading ? '...' : '⬡ Detect ring'}
        </button>
      </div>

      {/* Ring stats */}
      {ringStats && (
        <div style={{display:'flex',gap:10,marginBottom:16}}>
          <span className="tag tag-purple">⬡ {ringStats.total} accounts found</span>
          <span className="tag tag-red">⚠ {ringStats.flagged} flagged</span>
          <span className="tag tag-orange">{ringStats.edges} connections</span>
          <span className="tag tag-green mono" style={{marginLeft:'auto'}}>TigerGraph · ~80ms</span>
        </div>
      )}

      {/* Graph + sidebar */}
      <div style={{display:'grid', gridTemplateColumns:'1fr 280px', gap:16, alignItems:'start'}}>

        {/* Cytoscape canvas */}
        <div className="graph-container" style={{height:520}}>
          {elements.length === 0 && !loading && (
            <div style={{
              position:'absolute',inset:0,display:'flex',flexDirection:'column',
              alignItems:'center',justifyContent:'center',gap:12,color:'var(--text3)'
            }}>
              <div style={{fontSize:40}}>⬡</div>
              <div style={{fontSize:13,fontFamily:'var(--mono)'}}>Enter an account ID above</div>
              <div style={{fontSize:11}}>Try: ACC00001, ACC00042, ACC00123</div>
            </div>
          )}

          {loading && (
            <div style={{
              position:'absolute',inset:0,display:'flex',flexDirection:'column',
              alignItems:'center',justifyContent:'center',gap:12,color:'var(--text2)',
              background:'rgba(10,12,16,0.8)',zIndex:10
            }}>
              <div style={{fontSize:13,fontFamily:'var(--mono)',color:'var(--accent)'}}>
                ⬡ traversing graph...
              </div>
            </div>
          )}

          {elements.length > 0 && (
            <CytoscapeComponent
              elements={elements}
              stylesheet={CY_STYLE}
              layout={{ name: 'cose', padding: 40, nodeRepulsion: 4500, idealEdgeLength: 120 }}
              style={{ width: '100%', height: '100%' }}
              cy={(cy) => {
                cyRef.current = cy
                cy.on('tap', 'node', (e) => onNodeTap(e.target))
              }}
            />
          )}

          {/* Legend */}
          <div className="graph-overlay">
            <div className="graph-legend">
              <span><span className="legend-dot" style={{background:'var(--accent)'}}></span>flagged</span>
              <span><span className="legend-dot" style={{background:'var(--purple)'}}></span>origin</span>
              <span><span className="legend-dot" style={{background:'var(--blue)'}}></span>connected</span>
            </div>
            <div className="graph-legend" style={{fontSize:10}}>
              <span style={{color:'var(--blue)'}}>─ device</span>
              <span style={{color:'var(--purple)'}}>─ IP</span>
            </div>
          </div>
        </div>

        {/* Selected node panel */}
        <div className="flex-col gap-3">
          <div className="card">
            <div className="card-title">Selected node</div>
            {selectedNode
              ? (
                <div style={{fontSize:13}}>
                  <div style={{fontWeight:600,fontSize:15,marginBottom:4}}>{selectedNode.label}</div>
                  <div className="mono" style={{fontSize:11,color:'var(--text3)',marginBottom:14}}>{selectedNode.id}</div>

                  <div style={{display:'flex',flexDirection:'column',gap:10}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <span style={{color:'var(--text2)'}}>Fraud score</span>
                      <span className={`score-badge ${scoreClass(selectedNode.fraud_score)}`}>
                        {selectedNode.fraud_score.toFixed(3)}
                      </span>
                    </div>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <span style={{color:'var(--text2)'}}>Status</span>
                      <span className={`tag ${selectedNode.is_flagged ? 'tag-red' : 'tag-green'}`}>
                        {selectedNode.is_flagged ? 'FLAGGED' : 'CLEAN'}
                      </span>
                    </div>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <span style={{color:'var(--text2)'}}>Country</span>
                      <span className="mono" style={{fontSize:11}}>{selectedNode.country}</span>
                    </div>
                  </div>

                  <div style={{marginTop:14,display:'flex',gap:6}}>
                    <button
                      className="btn btn-primary btn-sm"
                      style={{flex:1}}
                      onClick={() => { setQuery(selectedNode.id); runDetection(selectedNode.id) }}
                    >Pivot here</button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setSelected(null)}
                    >✕</button>
                  </div>
                </div>
              )
              : (
                <div style={{fontSize:12,color:'var(--text3)',fontFamily:'var(--mono)'}}>
                  Click any node in the graph to inspect it
                </div>
              )
            }
          </div>

          {/* GSQL hint */}
          <div className="card">
            <div className="card-title">Running query</div>
            <pre style={{
              fontSize:10,fontFamily:'var(--mono)',
              color:'var(--text3)',lineHeight:1.7,
              whiteSpace:'pre-wrap',wordBreak:'break-all'
            }}>
{`detect_fraud_rings(
  start="${query || 'ACC00001'}",
  max_hops=${hops}
)

// TigerGraph traverses
// ${hops}-hop neighborhood via
// SHARES_DEVICE & SHARES_IP
// edges in ~80ms`}
            </pre>
          </div>
        </div>

      </div>
    </div>
  )
}
