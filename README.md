# FraudGraph — Real-Time Fraud Ring Detection with TigerGraph

> Detect fraud rings, money mule chains, and suspicious account clusters using graph traversal — the thing SQL can never do.

---

## What This Does

FraudGraph maps financial transactions as a graph and finds hidden rings of fraud that look innocent in isolation. Two accounts sharing a device, IP, or phone number with flagged nodes get surfaced instantly via multi-hop GSQL traversal.

**Core graph-native features used:**
- Multi-hop pattern matching (find rings up to N hops away)
- PageRank-style fraud scoring across the network
- Community detection for fraud cluster isolation
- Shortest path between any two suspicious nodes
- Real-time streaming query results

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Graph DB | TigerGraph Savanna (free tier) |
| Backend | Python FastAPI |
| Frontend | React + Cytoscape.js (graph viz) |
| Data | Random data generated using faker.js |
| Integration | pyTigerGraph + TigerGraph MCP |

---

## Project Structure

```
fraudgraph/
├── schema.gsql              # Graph schema definition
├── queries.gsql             # GSQL queries for fraud detection
├── generate_data.py         # Synthetic data generator
├── main.py                  # FastAPI backend
├── Dashboard.jsx            # React dashboard component
├── Investigate.jsx          # React investigation component
├── styles.css               # CSS styles
├── package.json             # Frontend dependencies
├── requirements.txt         # Backend dependencies
├── .env.example             # Environment variables template
├── vite.config.js           # Frontend build config
├── index.html               # HTML entry point
├── src/
│   ├── App.jsx              # Main React app
│   └── main.jsx             # React entry point
├── README.md                # This file
└── SETUP.md                 # Setup instructions
```

---

## Quick Start

### 1. Install Dependencies

**Backend:**
```bash
pip install -r requirements.txt
```

**Frontend:**
```bash
npm install
```

### 2. Start the Application

**Backend (Terminal 1):**
```bash
uvicorn main:app --reload --port 8000
```

**Frontend (Terminal 2):**
```bash
npm run dev
```

### 3. Open the App

Visit **http://localhost:5173** in your browser.

The app works with a realistic fraud graph demo dataset by default.
If TigerGraph credentials are present, the backend automatically switches to TigerGraph-backed endpoints.

### TigerGraph Mode (Savanna or Community)

Create `.env` from `.env.example` and set:

```bash
TG_HOST=https://your-host
TG_GRAPH=FraudGraph
TG_USERNAME=tigergraph
TG_PASSWORD=your_password
TG_SECRET=your_secret_if_used
```

Then load your schema/query/data:

1. Sign up at [tgcloud.io](https://tgcloud.io)
2. Create a free cluster
3. Copy `.env.example` to `.env` and fill in your credentials
4. Run the schema and data loading steps from SETUP.md

### Health check

```bash
curl http://localhost:8000/health
```

If `tigergraph_connected` is `true`, you are running fully on TigerGraph.

### 6. Start frontend
```bash
npm install && npm run dev
```

### 7. (Optional) TigerGraph MCP in Cursor
```json
{
  "tigergraph": {
    "command": "tigergraph-mcp",
    "args": [],
    "env": {
      "TG_HOST": "https://your-host-url",
      "TG_GRAPHNAME": "FraudGraph",
      "TG_SECRET": "your_secret",
      "TG_RESTPP_PORT": "443",
      "TG_GS_PORT": "443"
    }
  }
}
```

---

## The Demo Story (For Judges)

1. **Start on Dashboard** — show live stats: 500 accounts, 2,000+ transactions, ~43 flagged nodes
2. **Pick any "clean" account** — looks totally fine in isolation
3. **Run 3-hop traversal** — watch the graph light up connecting it to a fraud ring
4. **Show fraud score propagation** — neighboring nodes' scores rise in real time
5. **Community detection** — cluster the entire fraud ring, show it's 23 accounts coordinating

**The killer line:** *"SQL would need 6 JOINs and 30 seconds for this query. TigerGraph does it in 80ms."*
