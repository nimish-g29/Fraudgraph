# FraudGraph — Setup Guide

## Step 1: TigerGraph Savanna (5 minutes)

1. Go to **https://tgcloud.io** → Sign up with a new account
2. Click **"Create Solution"** → Choose **Enterprise** (free $60 credits)
3. Name your solution `FraudGraph`, pick any region
4. Wait ~3 minutes for it to spin up
5. Once running, click **"Access Tools"** → note your credentials:
   - **Host URL** (looks like `https://abc123.i.tgcloud.io`)
   - **Username** (default: `tigergraph`)
   - **Password** (you set this)
   - **Secret** → go to Admin Portal → User Management → Create Secret

---

## Step 2: Create the Graph Schema

### Option A — Via TigerGraph MCP (recommended for the hackathon)
1. Install: `pip install pyTigerGraph-mcp`
2. Add MCP config to Cursor (see README)
3. Open Cursor chat and paste:
   ```
   Using TigerGraph, create a graph called FraudGraph with this schema:
   [paste contents of schema.gsql]
   ```

### Option B — Via GraphStudio
1. In Savanna, click **GraphStudio**
2. Go to **Design Schema** → click **+** to add vertex types
3. Add: Account, Device, IPAddress, Transaction, MerchantCategory
4. Add edges as defined in `schema.gsql`
5. Click **Publish Schema**

### Option C — Via GSQL terminal
1. In Savanna → **GSQL Editor**
2. Paste the entire contents of `schema.gsql`
3. Run it

---

## Step 3: Configure credentials

```bash
cp .env.example .env
```

Edit `.env`:
```
TG_HOST=https://your-cluster.i.tgcloud.io
TG_GRAPHNAME=FraudGraph
TG_USERNAME=tigergraph
TG_PASSWORD=your_password
TG_SECRET=your_secret
```

---

## Step 4: Install GSQL Queries

In Savanna's GSQL Editor, paste and run:
1. `queries.gsql` — installs all 4 queries
2. Run: `INSTALL QUERY ALL`

---

## Step 5: Generate & Load Data

```bash
pip install -r requirements.txt
python generate_data.py --load
```

This generates 500 accounts, 2000+ transactions, 6 embedded fraud rings.

---

## Step 6: Start the Backend

```bash
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Test it: http://localhost:8000/stats

---

## Step 7: Start the Frontend

```bash
npm install
npm run dev
```

Open: http://localhost:5173

---

## Step 8: Optional — TigerGraph MCP in Cursor

Add to Cursor MCP settings:
```json
{
  "tigergraph": {
    "command": "tigergraph-mcp",
    "args": [],
    "env": {
      "TG_HOST": "https://your-cluster.i.tgcloud.io",
      "TG_GRAPHNAME": "FraudGraph",
      "TG_SECRET": "your_secret",
      "TG_RESTPP_PORT": "443",
      "TG_GS_PORT": "443"
    }
  }
}
```

Now you can say in Cursor: *"Run the detect_fraud_rings query for ACC00001"* and it executes live.

---

## Demo Script (for judges)

1. Open Dashboard → show 500 accounts, 2347 transactions, 43 flagged
2. Click any flagged account → jumps to Investigate page
3. Watch the graph render the fraud ring in real time
4. Click a "clean" looking node → show its fraud score is elevated because of neighbors
5. Change hops from 3→4 → watch the ring expand
6. Click a node → hit "Pivot here" → traverse from a different starting point
7. Point to the GSQL panel → explain the query is running in TigerGraph, not in app memory

**Killer line:** *"This 4-hop traversal across 500 accounts takes 80ms in TigerGraph. The equivalent SQL would require recursive CTEs, 6+ JOINs, and still timeout."*
