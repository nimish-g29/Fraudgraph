import os
import random
from datetime import datetime, timedelta
from typing import Any, Dict, List, Tuple

from dotenv import load_dotenv
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

try:
    import pyTigerGraph as tg
except Exception:
    tg = None

load_dotenv()

app = FastAPI(title="FraudGraph API", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class DetectRingPayload(BaseModel):
    account_id: str = Field(..., min_length=1)
    max_hops: int = Field(3, ge=1, le=6)


def _vertex_to_account(v: Dict[str, Any]) -> Dict[str, Any]:
    attrs = v.get("attributes", {})
    account_id = v.get("v_id") or attrs.get("account_id") or v.get("id")
    return {
        "v_id": account_id,
        "attributes": {
            "name": attrs.get("name", account_id),
            "fraud_score": float(attrs.get("fraud_score", 0.0)),
            "is_flagged": bool(attrs.get("is_flagged", False)),
            "country": attrs.get("country", "N/A"),
        },
    }


def _node(account: Dict[str, Any], is_origin: bool = False) -> Dict[str, Any]:
    attrs = account["attributes"]
    return {
        "data": {
            "id": account["v_id"],
            "label": attrs.get("name", account["v_id"]),
            "fraud_score": attrs.get("fraud_score", 0.0),
            "is_flagged": attrs.get("is_flagged", False),
            "country": attrs.get("country", "N/A"),
            "is_origin": is_origin,
        }
    }


def _edge(edge_id: str, source: str, target: str, edge_type: str) -> Dict[str, Any]:
    return {"data": {"id": edge_id, "source": source, "target": target, "type": edge_type}}


def _build_demo_dataset(seed: int = 2026) -> Tuple[List[Dict[str, Any]], List[Tuple[str, str, str]]]:
    rng = random.Random(seed)
    accounts: List[Dict[str, Any]] = []
    edges: List[Tuple[str, str, str]] = []

    countries = ["IN", "US", "AE", "SG", "GB", "DE"]
    for i in range(1, 121):
        score = round(rng.uniform(0.02, 0.45), 3)
        accounts.append(
            {
                "v_id": f"ACC{i:05d}",
                "attributes": {
                    "name": f"Account {i:03d}",
                    "fraud_score": score,
                    "is_flagged": False,
                    "country": countries[i % len(countries)],
                },
            }
        )

    # Inject a fraud ring cluster with strong interconnections.
    ring_ids = [f"ACC{i:05d}" for i in range(7, 19)]
    for acc in accounts:
        if acc["v_id"] in ring_ids:
            acc["attributes"]["is_flagged"] = True
            acc["attributes"]["fraud_score"] = round(rng.uniform(0.74, 0.99), 3)

    for i, src in enumerate(ring_ids):
        tgt = ring_ids[(i + 1) % len(ring_ids)]
        edges.append((src, tgt, "SHARES_DEVICE"))
        tgt2 = ring_ids[(i + 3) % len(ring_ids)]
        edges.append((src, tgt2, "SHARES_IP"))

    # Add background edges so graph looks realistic.
    ids = [a["v_id"] for a in accounts]
    for _ in range(220):
        s = rng.choice(ids)
        t = rng.choice(ids)
        if s != t:
            edge_type = "SHARES_DEVICE" if rng.random() < 0.55 else "SHARES_IP"
            edges.append((s, t, edge_type))

    return accounts, edges


DEMO_ACCOUNTS, DEMO_EDGES = _build_demo_dataset()
DEMO_BY_ID = {a["v_id"]: a for a in DEMO_ACCOUNTS}


def _build_demo_transactions(seed: int = 99, count: int = 350) -> List[Dict[str, Any]]:
    rng = random.Random(seed)
    ids = [a["v_id"] for a in DEMO_ACCOUNTS]
    now = datetime.utcnow()
    rows: List[Dict[str, Any]] = []

    for i in range(count):
        sender = rng.choice(ids)
        receiver = rng.choice(ids)
        while receiver == sender:
            receiver = rng.choice(ids)

        amount = round(rng.uniform(20, 12000), 2)
        suspicious = amount > 5000 or (DEMO_BY_ID[sender]["attributes"]["is_flagged"] and rng.random() < 0.5)
        ts = (now - timedelta(minutes=i * rng.randint(1, 4))).isoformat()

        rows.append(
            {
                "tx_id": f"TX{i:06d}",
                "sender": sender,
                "receiver": receiver,
                "amount": amount,
                "currency": "USD",
                "timestamp": ts,
                "is_fraud": bool(suspicious),
                "risk_score": round(min(0.99, amount / 12000 + (0.4 if suspicious else 0.05)), 3),
            }
        )

    rows.sort(key=lambda x: x["timestamp"], reverse=True)
    return rows


DEMO_TRANSACTIONS = _build_demo_transactions()


class TigerGraphService:
    def __init__(self) -> None:
        self.enabled = False
        self.error = None
        self.conn = None
        self._connect()

    def _connect(self) -> None:
        if tg is None:
            self.error = "pyTigerGraph not importable"
            return

        host = os.getenv("TG_HOST")
        graph = os.getenv("TG_GRAPH") or os.getenv("TG_GRAPHNAME")
        if not host or not graph:
            self.error = "Missing TigerGraph env vars. Required: TG_HOST and TG_GRAPHNAME (or TG_GRAPH)"
            return

        try:
            self.conn = tg.TigerGraphConnection(
                host=host,
                username=os.getenv("TG_USERNAME"),
                password=os.getenv("TG_PASSWORD"),
                graphname=graph,
            )

            secret = os.getenv("TG_SECRET")
            if secret:
                self.conn.getToken(secret)

            # Minimal capability check.
            self.conn.getVertexCount("Account")
            self.enabled = True
        except Exception as exc:
            self.error = str(exc)
            self.enabled = False

    def missing_env(self) -> List[str]:
        missing = []
        if not os.getenv("TG_HOST"):
            missing.append("TG_HOST")
        if not (os.getenv("TG_GRAPHNAME") or os.getenv("TG_GRAPH")):
            missing.append("TG_GRAPHNAME (or TG_GRAPH)")
        if not os.getenv("TG_USERNAME"):
            missing.append("TG_USERNAME")
        if not os.getenv("TG_PASSWORD"):
            missing.append("TG_PASSWORD")
        if not os.getenv("TG_SECRET"):
            missing.append("TG_SECRET")
        return missing

    def get_flagged_accounts(self, limit: int) -> List[Dict[str, Any]]:
        if not self.enabled:
            raise RuntimeError("TigerGraph unavailable")

        # Preferred path: use installed query if present.
        try:
            res = self.conn.runInstalledQuery("get_flagged_accounts", {"limit": limit})
            rows = res[0].get("accounts", [])
            return [_vertex_to_account(v) for v in rows[:limit]]
        except Exception:
            pass

        # Fallback: direct vertex read.
        rows = self.conn.getVertices("Account", select="name,fraud_score,is_flagged,country", where="is_flagged=true", limit=limit)
        return [_vertex_to_account(v) for v in rows]

    def get_stats(self) -> Dict[str, int]:
        if not self.enabled:
            raise RuntimeError("TigerGraph unavailable")

        total_accounts = int(self.conn.getVertexCount("Account"))
        total_devices = int(self.conn.getVertexCount("Device"))
        total_ips = int(self.conn.getVertexCount("IPAddress"))
        total_transactions = int(self.conn.getVertexCount("Transaction"))
        try:
            total_edges = int(self.conn.getEdgeCount("*"))
        except Exception:
            total_edges = 0

        flagged = self.get_flagged_accounts(limit=5000)
        return {
            "total_accounts": total_accounts,
            "total_transactions": total_transactions,
            "total_devices": total_devices,
            "total_ips": total_ips,
            "flagged_accounts": len(flagged),
            "total_edges": total_edges,
        }

    def detect_ring(self, account_id: str, max_hops: int) -> Dict[str, Any]:
        if not self.enabled:
            raise RuntimeError("TigerGraph unavailable")

        try:
            res = self.conn.runInstalledQuery(
                "detect_fraud_rings",
                {"start_account": account_id, "max_hops": max_hops},
            )
        except Exception:
            res = self.conn.runInstalledQuery(
                "detect_fraud_rings",
                {"start": account_id, "max_hops": max_hops},
            )

        # Query output formats vary; normalize to cytoscape-ready payload.
        payload = res[0] if isinstance(res, list) and res else {}
        ring_set = payload.get("ring_set") or payload.get("nodes") or []
        raw_edges = payload.get("@@ring_edges") or payload.get("edges") or []

        nodes = []
        for v in ring_set:
            acc = _vertex_to_account(v)
            nodes.append(_node(acc, is_origin=(acc["v_id"] == account_id)))

        edges = []
        for i, e in enumerate(raw_edges):
            src = e.get("from_id") or e.get("from")
            tgt = e.get("to_id") or e.get("to")
            if src and tgt:
                edges.append(_edge(f"tg-e-{i}", src, tgt, e.get("e_type", "SHARES_DEVICE")))

        if not nodes:
            raise RuntimeError("TigerGraph query returned empty/unsupported payload")

        return {"nodes": nodes, "edges": edges, "source": "tigergraph"}


TG = TigerGraphService()


def _demo_flagged(limit: int) -> List[Dict[str, Any]]:
    rows = [a for a in DEMO_ACCOUNTS if a["attributes"]["is_flagged"]]
    rows.sort(key=lambda x: x["attributes"]["fraud_score"], reverse=True)
    return rows[:limit]


def _demo_stats() -> Dict[str, int]:
    return {
        "total_accounts": len(DEMO_ACCOUNTS),
        "total_transactions": 2374,
        "total_devices": 180,
        "total_ips": 120,
        "flagged_accounts": len([a for a in DEMO_ACCOUNTS if a["attributes"]["is_flagged"]]),
        "total_edges": len(DEMO_EDGES),
    }


def _demo_detect_ring(account_id: str, max_hops: int) -> Dict[str, Any]:
    if account_id not in DEMO_BY_ID:
        idx = (sum(ord(ch) for ch in account_id) % len(DEMO_ACCOUNTS)) + 1
        account_id = f"ACC{idx:05d}"

    adj: Dict[str, List[Tuple[str, str]]] = {}
    for s, t, edge_type in DEMO_EDGES:
        adj.setdefault(s, []).append((t, edge_type))
        adj.setdefault(t, []).append((s, edge_type))

    seen = {account_id}
    frontier = [account_id]
    picked_edges: List[Tuple[str, str, str]] = []

    for _ in range(max_hops):
        next_frontier = []
        for node in frontier:
            for nb, edge_type in adj.get(node, [])[:6]:
                picked_edges.append((node, nb, edge_type))
                if nb not in seen:
                    seen.add(nb)
                    next_frontier.append(nb)
        frontier = next_frontier
        if not frontier:
            break

    nodes = [_node(DEMO_BY_ID[nid], is_origin=(nid == account_id)) for nid in seen]
    edges = [_edge(f"demo-e-{i}", s, t, e) for i, (s, t, e) in enumerate(picked_edges[:500])]

    return {"nodes": nodes, "edges": edges, "source": "demo"}


def _demo_communities() -> List[Dict[str, Any]]:
    adj: Dict[str, List[str]] = {}
    for s, t, _ in DEMO_EDGES:
        adj.setdefault(s, []).append(t)
        adj.setdefault(t, []).append(s)

    seen = set()
    communities: List[Dict[str, Any]] = []
    for acc in DEMO_BY_ID:
        if acc in seen:
            continue
        stack = [acc]
        members = []
        seen.add(acc)
        while stack:
            cur = stack.pop()
            members.append(cur)
            for nb in adj.get(cur, []):
                if nb not in seen:
                    seen.add(nb)
                    stack.append(nb)

        if len(members) < 4:
            continue
        flagged = sum(1 for m in members if DEMO_BY_ID[m]["attributes"]["is_flagged"])
        communities.append(
            {
                "community_id": f"C{len(communities)+1:02d}",
                "size": len(members),
                "flagged": flagged,
                "risk_ratio": round(flagged / max(1, len(members)), 3),
                "members": members[:40],
            }
        )

    communities.sort(key=lambda c: (c["flagged"], c["size"]), reverse=True)
    return communities[:12]


@app.get("/health")
def health() -> Dict[str, Any]:
    return {
        "ok": True,
        "tigergraph_connected": TG.enabled,
        "reason": TG.error,
        "missing_env": TG.missing_env(),
    }


@app.get("/stats")
def stats() -> Dict[str, int]:
    try:
        return TG.get_stats()
    except Exception:
        return _demo_stats()


@app.get("/accounts/flagged")
def flagged_accounts(limit: int = Query(default=30, ge=1, le=200)) -> List[Dict[str, Any]]:
    try:
        return TG.get_flagged_accounts(limit)
    except Exception:
        return _demo_flagged(limit)


@app.post("/ring/detect")
def detect_ring(payload: DetectRingPayload) -> Dict[str, Any]:
    try:
        return TG.detect_ring(payload.account_id, payload.max_hops)
    except Exception:
        return _demo_detect_ring(payload.account_id, payload.max_hops)


@app.get("/graph")
def graph() -> Dict[str, Any]:
    try:
        if TG.enabled:
            candidates = ["get_full_graph", "graph_overview", "get_graph"]
            for q in candidates:
                try:
                    res = TG.conn.runInstalledQuery(q)
                    payload = res[0] if isinstance(res, list) and res else {}
                    nodes = payload.get("nodes") or []
                    edges = payload.get("edges") or []
                    if nodes and edges:
                        return {"nodes": nodes, "edges": edges}
                except Exception:
                    continue
    except Exception:
        pass

    nodes = [{"id": a["v_id"], "risk": round(a["attributes"]["fraud_score"] * 100, 2)} for a in DEMO_ACCOUNTS]
    edges = [{"source": s, "target": t, "type": typ} for s, t, typ in DEMO_EDGES[:800]]
    return {"nodes": nodes, "edges": edges}


@app.get("/transactions")
def transactions(limit: int = Query(default=120, ge=10, le=500)) -> List[Dict[str, Any]]:
    try:
        if TG.enabled:
            candidates = ["get_transactions", "timeline_transactions", "recent_transactions"]
            for q in candidates:
                try:
                    res = TG.conn.runInstalledQuery(q, {"limit_results": limit, "limit": limit})
                    payload = res[0] if isinstance(res, list) and res else {}
                    rows = payload.get("transactions") or payload.get("result") or []
                    if rows:
                        return rows[:limit]
                except Exception:
                    continue
    except Exception:
        pass
    return DEMO_TRANSACTIONS[:limit]


@app.get("/communities")
def communities() -> List[Dict[str, Any]]:
    try:
        if TG.enabled:
            candidates = ["detect_communities", "get_communities", "community_clusters"]
            for q in candidates:
                try:
                    res = TG.conn.runInstalledQuery(q)
                    payload = res[0] if isinstance(res, list) and res else {}
                    rows = payload.get("communities") or payload.get("result") or payload.get("@@clusters") or []
                    if rows:
                        return rows
                except Exception:
                    continue
    except Exception:
        pass
    return _demo_communities()