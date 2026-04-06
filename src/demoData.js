function seededRandom(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

const rng = seededRandom(2026)
const countries = ["IN", "US", "AE", "SG", "GB", "DE"]

export const DEMO_ACCOUNTS = Array.from({ length: 120 }, (_, i) => {
  const idNum = i + 1
  const id = `ACC${String(idNum).padStart(5, "0")}`
  const isFlagged = idNum >= 7 && idNum <= 18
  return {
    id,
    name: `Account ${String(idNum).padStart(3, "0")}`,
    risk: isFlagged ? 74 + Math.round(rng() * 24) : 2 + Math.round(rng() * 43),
    is_flagged: isFlagged,
    country: countries[idNum % countries.length]
  }
})

const ringIds = DEMO_ACCOUNTS.filter((a) => a.is_flagged).map((a) => a.id)
export const DEMO_EDGES = []

for (let i = 0; i < ringIds.length; i++) {
  const a = ringIds[i]
  const b = ringIds[(i + 1) % ringIds.length]
  const c = ringIds[(i + 3) % ringIds.length]
  DEMO_EDGES.push({ source: a, target: b, type: "SHARES_DEVICE" })
  DEMO_EDGES.push({ source: a, target: c, type: "SHARES_IP" })
}

for (let i = 0; i < 220; i++) {
  const a = DEMO_ACCOUNTS[Math.floor(rng() * DEMO_ACCOUNTS.length)].id
  const b = DEMO_ACCOUNTS[Math.floor(rng() * DEMO_ACCOUNTS.length)].id
  if (a === b) continue
  DEMO_EDGES.push({
    source: a,
    target: b,
    type: rng() > 0.45 ? "SHARES_DEVICE" : "SHARES_IP"
  })
}

const byId = Object.fromEntries(DEMO_ACCOUNTS.map((a) => [a.id, a]))

export function demoGraphResponse() {
  return {
    nodes: DEMO_ACCOUNTS.map((a) => ({ id: a.id, risk: a.risk })),
    edges: DEMO_EDGES.slice(0, 800)
  }
}

export function demoRingDetect(accountId = "ACC00007", maxHops = 3) {
  const start = byId[accountId] ? accountId : "ACC00007"
  const adj = new Map()
  for (const e of DEMO_EDGES) {
    if (!adj.has(e.source)) adj.set(e.source, [])
    if (!adj.has(e.target)) adj.set(e.target, [])
    adj.get(e.source).push({ id: e.target, type: e.type })
    adj.get(e.target).push({ id: e.source, type: e.type })
  }

  const seen = new Set([start])
  let frontier = [start]
  const picked = []

  for (let h = 0; h < maxHops; h++) {
    const next = []
    for (const cur of frontier) {
      const neighbors = (adj.get(cur) || []).slice(0, 6)
      for (const nb of neighbors) {
        picked.push({ source: cur, target: nb.id, type: nb.type })
        if (!seen.has(nb.id)) {
          seen.add(nb.id)
          next.push(nb.id)
        }
      }
    }
    frontier = next
    if (!frontier.length) break
  }

  const nodes = Array.from(seen).map((id) => {
    const a = byId[id]
    return {
      data: {
        id,
        label: a?.name || id,
        fraud_score: (a?.risk || 0) / 100,
        is_flagged: !!a?.is_flagged,
        country: a?.country || "N/A",
        is_origin: id === start
      }
    }
  })
  const edges = picked.slice(0, 350).map((e, i) => ({
    data: { id: `de-${i}`, source: e.source, target: e.target, type: e.type }
  }))

  return { nodes, edges }
}

export function demoCommunities() {
  const ids = DEMO_ACCOUNTS.map((a) => a.id)
  const groups = [
    ids.slice(0, 22),
    ids.slice(22, 45),
    ids.slice(45, 69),
    ids.slice(69, 92),
    ids.slice(92, 120)
  ]
  return groups.map((members, i) => {
    const flagged = members.filter((m) => byId[m]?.is_flagged).length
    return {
      community_id: `C${String(i + 1).padStart(2, "0")}`,
      size: members.length,
      flagged,
      risk_ratio: flagged / Math.max(1, members.length),
      members
    }
  })
}

export const DEMO_TRANSACTIONS = Array.from({ length: 180 }, (_, i) => {
  const sender = DEMO_ACCOUNTS[Math.floor(rng() * DEMO_ACCOUNTS.length)].id
  let receiver = DEMO_ACCOUNTS[Math.floor(rng() * DEMO_ACCOUNTS.length)].id
  if (receiver === sender) receiver = "ACC00007"
  const amount = Math.round((20 + rng() * 12000) * 100) / 100
  const is_fraud = amount > 5000 || byId[sender]?.is_flagged
  const risk_score = Math.min(0.99, amount / 12000 + (is_fraud ? 0.4 : 0.05))
  return {
    tx_id: `TX${String(i).padStart(6, "0")}`,
    sender,
    receiver,
    amount,
    timestamp: new Date(Date.now() - i * 300000).toISOString(),
    is_fraud,
    risk_score
  }
})
