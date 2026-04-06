"""
Synthetic fraud data generator for FraudGraph.
Generates realistic account/transaction/device data with embedded fraud rings.

Usage:
  python generate_data.py              # Generate CSVs only
  python generate_data.py --load       # Generate + load into TigerGraph
"""

import random
import csv
import os
import argparse
from datetime import datetime, timedelta
from faker import Faker
import pyTigerGraph as tg
from dotenv import load_dotenv

load_dotenv()
fake = Faker()
random.seed(42)

# ── Config ──────────────────────────────────────────────────────────────────
N_ACCOUNTS     = 500
N_DEVICES      = 180
N_IPS          = 120
N_TRANSACTIONS = 2000
N_FRAUD_RINGS  = 6   # embedded fraud rings
RING_SIZE      = (4, 9)  # min/max accounts per ring

CATEGORIES = ["retail", "gambling", "crypto_exchange", "travel", "food",
              "electronics", "luxury_goods", "money_transfer", "atm"]
RISK_MAP   = {"gambling": "high", "crypto_exchange": "high",
              "money_transfer": "high", "luxury_goods": "medium",
              "atm": "medium", "retail": "low", "travel": "low",
              "food": "low", "electronics": "low"}

output_dir = os.path.abspath(os.path.dirname(__file__) or '.')


# ── Generators ───────────────────────────────────────────────────────────────

def gen_accounts(n):
    accounts = []
    for i in range(n):
        accounts.append({
            "account_id": f"ACC{i:05d}",
            "name":       fake.name(),
            "email":      fake.email(),
            "phone":      fake.phone_number()[:15],
            "created_at": fake.date_between("-3y", "today").isoformat(),
            "country":    fake.country_code(),
            "is_flagged": "false",
            "fraud_score": 0.0,
        })
    return accounts


def gen_devices(n):
    devices = []
    types = ["mobile", "desktop", "tablet"]
    oses  = ["Android", "iOS", "Windows", "macOS", "Linux"]
    browsers = ["Chrome", "Firefox", "Safari", "Edge", "Opera"]
    for i in range(n):
        devices.append({
            "device_id":   f"DEV{i:05d}",
            "device_type": random.choice(types),
            "os":          random.choice(oses),
            "browser":     random.choice(browsers),
        })
    return devices


def gen_ips(n):
    ips = []
    seen = set()
    attempts = 0
    while len(ips) < n and attempts < n * 10:
        attempts += 1
        ip = fake.ipv4_public()
        if ip in seen:
            continue
        seen.add(ip)
        ips.append({
            "ip":       ip,
            "country":  fake.country_code(),
            "is_vpn":   str(random.random() < 0.1).lower(),
            "is_tor":   str(random.random() < 0.03).lower(),
        })
    return ips


# ── NEW GENERATORS ───────────────────────────────────────────────────────────

def gen_locations(n):
    locations = []
    for i in range(n):
        locations.append({
            "location_id": f"LOC{i:05d}",
            "city": fake.city(),
            "country": fake.country_code(),
            "risk_score": round(random.uniform(0.0, 1.0), 3),
        })
    return locations


def gen_profiles(n, accounts):
    profiles = []
    patterns = ["morning", "evening", "night", "weekend", "business_hours"]
    for i in range(n):
        acc = random.choice(accounts)
        profiles.append({
            "profile_id": f"PROF{i:05d}",
            "login_pattern": random.choice(patterns),
            "avg_transaction_amount": round(random.uniform(10, 1000), 2),
            "transaction_frequency": random.randint(1, 50),
            "risk_profile": random.choice(["low", "medium", "high"]),
            "account_id": acc["account_id"],  # Link to account
        })
    return profiles


def gen_transactions(accounts, n):
    txs = []
    account_ids = [a["account_id"] for a in accounts]
    now = datetime.now()
    for i in range(n):
        sender = random.choice(account_ids)
        receiver = random.choice(account_ids)
        while receiver == sender:
            receiver = random.choice(account_ids)
        ts = now - timedelta(days=random.randint(0, 365), hours=random.randint(0, 23))
        txs.append({
            "tx_id":    f"TX{i:06d}",
            "amount":   round(random.uniform(1, 5000), 2),
            "currency": random.choice(["USD", "EUR", "GBP", "INR"]),
            "timestamp": ts.isoformat(),
            "tx_type":  random.choice(["transfer", "payment", "withdrawal", "deposit"]),
            "status":   random.choice(["completed", "completed", "completed", "failed", "pending"]),
            "is_fraud": "false",
            "sender":   sender,
            "receiver": receiver,
            "category": random.choice(CATEGORIES),
        })
    return txs


def embed_fraud_rings(accounts, devices, ips, transactions):
    """Inject coordinated fraud rings into the data."""
    fraud_account_ids = []
    shared_device_edges = []
    shared_ip_edges     = []

    for ring_idx in range(N_FRAUD_RINGS):
        ring_size  = random.randint(*RING_SIZE)
        ring_accs  = random.sample(accounts, ring_size)
        ring_dev   = random.choice(devices)
        ring_ip    = random.choice(ips)

        # Flag them all
        for acc in ring_accs:
            acc["is_flagged"]  = "true"
            acc["fraud_score"] = round(random.uniform(0.6, 1.0), 3)
            fraud_account_ids.append(acc["account_id"])

        # Share a device and IP within ring
        for i, acc in enumerate(ring_accs):
            shared_device_edges.append({
                "from_account": acc["account_id"],
                "to_account":   ring_accs[(i + 1) % ring_size]["account_id"],
                "device_id":    ring_dev["device_id"],
                "count":        random.randint(1, 20),
            })
            shared_ip_edges.append({
                "from_account": acc["account_id"],
                "to_account":   ring_accs[(i + 2) % ring_size]["account_id"],
                "ip":           ring_ip["ip"],
                "count":        random.randint(1, 15),
            })

        # Make them transact among themselves frequently
        for _ in range(ring_size * 3):
            src = random.choice(ring_accs)
            dst = random.choice(ring_accs)
            if src == dst:
                continue
            transactions.append({
                "tx_id":    f"FTX{ring_idx}_{random.randint(0,9999):04d}",
                "amount":   round(random.uniform(500, 9999), 2),
                "currency": "USD",
                "timestamp": (datetime.now() - timedelta(days=random.randint(0, 30))).isoformat(),
                "tx_type":  "transfer",
                "status":   "completed",
                "is_fraud": "true",
                "sender":   src["account_id"],
                "receiver": dst["account_id"],
                "category": random.choice(["money_transfer", "crypto_exchange", "gambling"]),
            })

    return fraud_account_ids, shared_device_edges, shared_ip_edges


# ── CSV Writers ──────────────────────────────────────────────────────────────

def write_csv(filename, rows, fieldnames=None):
    if not rows:
        return
    path = os.path.join(output_dir, filename)
    with open(path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames or rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)
    print(f"  ✓ {filename} ({len(rows)} rows)")


# ── TigerGraph Loader ────────────────────────────────────────────────────────

def load_into_tigergraph(accounts, devices, ips, transactions,
                         used_device_edges, connected_from_edges,
                         shared_device_edges, shared_ip_edges,
                         locations, profiles, located_at_edges, has_profile_edges, ip_located_at_edges):
    required = {"TG_HOST", "TG_PASSWORD", "TG_SECRET"}
    missing = [k for k in required if not os.getenv(k)]
    if missing:
        print(f"\n❌ Missing required env vars: {', '.join(missing)}")
        print("   Copy .env.example → .env and fill in your TigerGraph Savanna credentials.")
        raise SystemExit(1)

    print("\n🔗 Connecting to TigerGraph Savanna...")
    conn = tg.TigerGraphConnection(
        host=os.getenv("TG_HOST"),
        graphname=os.getenv("TG_GRAPHNAME", "FraudGraph"),
        username=os.getenv("TG_USERNAME", "tigergraph"),
        password=os.getenv("TG_PASSWORD"),
        gsqlSecret=os.getenv("TG_SECRET"),
        restppPort=int(os.getenv("TG_RESTPP_PORT", 443)),
        gsPort=int(os.getenv("TG_GS_PORT", 443)),
        useCert=True,
    )
    conn.getToken(conn.createSecret())
    print("  ✓ Connected!\n")

    print("📥 Loading vertices...")
    conn.upsertVertices("Account", [(a["account_id"], {
        "name": a["name"], "email": a["email"], "phone": a["phone"],
        "created_at": a["created_at"], "country": a["country"],
        "is_flagged": a["is_flagged"] == "true",
        "fraud_score": float(a["fraud_score"]),
    }) for a in accounts])

    conn.upsertVertices("Device", [(d["device_id"], {
        "device_type": d["device_type"], "os": d["os"], "browser": d["browser"],
    }) for d in devices])

    conn.upsertVertices("IPAddress", [(i["ip"], {
        "country": i["country"],
        "is_vpn": i["is_vpn"] == "true",
        "is_tor": i["is_tor"] == "true",
    }) for i in ips])

    conn.upsertVertices("Transaction", [(t["tx_id"], {
        "amount": float(t["amount"]), "currency": t["currency"],
        "timestamp": t["timestamp"], "tx_type": t["tx_type"],
        "status": t["status"], "is_fraud": t["is_fraud"] == "true",
    }) for t in transactions])

    # NEW VERTICES
    conn.upsertVertices("Location", [(l["location_id"], {
        "city": l["city"], "country": l["country"], "risk_score": float(l["risk_score"]),
    }) for l in locations])

    conn.upsertVertices("UserProfile", [(p["profile_id"], {
        "login_pattern": p["login_pattern"], "avg_transaction_amount": float(p["avg_transaction_amount"]),
        "transaction_frequency": p["transaction_frequency"], "risk_profile": p["risk_profile"],
    }) for p in profiles])

    for cat, risk in RISK_MAP.items():
        conn.upsertVertex("MerchantCategory", cat, {"risk_level": risk})

    print("📥 Loading edges...")
    conn.upsertEdges("Account", "USED_DEVICE", "Device",
        [(e["account_id"], e["device_id"], {"last_seen": e["last_seen"]}) for e in used_device_edges])

    conn.upsertEdges("Account", "CONNECTED_FROM", "IPAddress",
        [(e["account_id"], e["ip"], {"times": e["times"]}) for e in connected_from_edges])

    conn.upsertEdges("Account", "SENT", "Transaction",
        [(t["sender"], t["tx_id"], {"timestamp": t["timestamp"]}) for t in transactions])

    conn.upsertEdges("Account", "RECEIVED", "Transaction",
        [(t["receiver"], t["tx_id"], {"timestamp": t["timestamp"]}) for t in transactions])

    conn.upsertEdges("Transaction", "IN_CATEGORY", "MerchantCategory",
        [(t["tx_id"], t["category"], {}) for t in transactions])

    conn.upsertEdges("Account", "SHARES_DEVICE", "Account",
        [(e["from_account"], e["to_account"], {"device_id": e["device_id"], "count": e["count"]}) for e in shared_device_edges])

    conn.upsertEdges("Account", "SHARES_IP", "Account",
        [(e["from_account"], e["to_account"], {"ip": e["ip"], "count": e["count"]}) for e in shared_ip_edges])

    # NEW EDGES
    conn.upsertEdges("Account", "LOCATED_AT", "Location",
        [(e["account_id"], e["location_id"], {"last_seen": e["last_seen"]}) for e in located_at_edges])

    conn.upsertEdges("Account", "HAS_PROFILE", "UserProfile",
        [(p["account_id"], p["profile_id"], {}) for p in profiles])

    conn.upsertEdges("IPAddress", "IP_LOCATED_AT", "Location",
        [(e["ip"], e["location_id"], {}) for e in ip_located_at_edges])

    print("\n✅ All data loaded into TigerGraph!")


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--load", action="store_true", help="Load into TigerGraph after generating")
    args = parser.parse_args()

    print("🔨 Generating synthetic fraud data...\n")

    accounts     = gen_accounts(N_ACCOUNTS)
    devices      = gen_devices(N_DEVICES)
    ips          = gen_ips(N_IPS)
    transactions = gen_transactions(accounts, N_TRANSACTIONS)

    # NEW GENERATIONS
    locations = gen_locations(50)  # 50 locations
    profiles = gen_profiles(N_ACCOUNTS // 2, accounts)  # Profiles for half accounts

    fraud_ids, shared_device_edges, shared_ip_edges = embed_fraud_rings(
        accounts, devices, ips, transactions
    )
    print(f"  ✓ Embedded {N_FRAUD_RINGS} fraud rings ({len(fraud_ids)} flagged accounts)")

    # Account→Device edges
    used_device_edges = []
    for acc in accounts:
        for _ in range(random.randint(1, 3)):
            dev = random.choice(devices)
            used_device_edges.append({
                "account_id": acc["account_id"],
                "device_id":  dev["device_id"],
                "last_seen":  fake.date_between("-1y", "today").isoformat(),
            })

    # Account→IP edges
    connected_from_edges = []
    for acc in accounts:
        for _ in range(random.randint(1, 4)):
            ip = random.choice(ips)
            connected_from_edges.append({
                "account_id": acc["account_id"],
                "ip":         ip["ip"],
                "times":      random.randint(1, 50),
            })

    # NEW EDGES
    located_at_edges = []
    for acc in accounts:
        loc = random.choice(locations)
        located_at_edges.append({
            "account_id": acc["account_id"],
            "location_id": loc["location_id"],
            "last_seen": fake.date_between("-1y", "today").isoformat(),
        })

    ip_located_at_edges = []
    for ip in ips:
        loc = random.choice(locations)
        ip_located_at_edges.append({
            "ip": ip["ip"],
            "location_id": loc["location_id"],
        })

    print("\n📄 Writing CSVs...")
    write_csv("accounts.csv", accounts)
    write_csv("devices.csv", devices)
    write_csv("ips.csv", ips)
    write_csv("transactions.csv", transactions)
    write_csv("locations.csv", locations)
    write_csv("profiles.csv", profiles)
    write_csv("used_device_edges.csv", used_device_edges)
    write_csv("connected_from_edges.csv", connected_from_edges)
    write_csv("shares_device_edges.csv", shared_device_edges)
    write_csv("shares_ip_edges.csv", shared_ip_edges)
    write_csv("located_at_edges.csv", located_at_edges)
    write_csv("ip_located_at_edges.csv", ip_located_at_edges)

    if args.load:
        load_into_tigergraph(accounts, devices, ips, transactions,
                             used_device_edges, connected_from_edges,
                             shared_device_edges, shared_ip_edges,
                             locations, profiles, located_at_edges, ip_located_at_edges)
    else:
        print("\n💡 Run with --load to push data into TigerGraph Savanna")

    print(f"\n📊 Summary:")
    print(f"  Accounts:     {len(accounts)}")
    print(f"  Devices:      {len(devices)}")
    print(f"  IPs:          {len(ips)}")
    print(f"  Transactions: {len(transactions)}")
    print(f"  Locations:    {len(locations)}")
    print(f"  Profiles:     {len(profiles)}")
    print(f"  Fraud rings:  {N_FRAUD_RINGS}")
    print(f"  Flagged accs: {len(fraud_ids)}")


if __name__ == "__main__":
    main()
