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

N_ACCOUNTS = 500
N_DEVICES = 180
N_IPS = 120
N_TRANSACTIONS = 2000
N_FRAUD_RINGS = 6
RING_SIZE = (4, 9)

CATEGORIES = ["retail","gambling","crypto_exchange","travel","food",
              "electronics","luxury_goods","money_transfer","atm"]

output_dir = os.path.abspath(os.path.dirname(__file__) or '.')


def gen_accounts(n):
    return [{
        "account_id": f"ACC{i:05d}",
        "name": fake.name(),
        "email": fake.email(),
        "phone": fake.phone_number()[:15],
        "created_at": fake.date_between("-3y", "today").isoformat(),
        "country": fake.country_code(),
        "is_flagged": "false",
        "fraud_score": 0.0,
    } for i in range(n)]


def gen_devices(n):
    types = ["mobile","desktop","tablet"]
    oses = ["Android","iOS","Windows","macOS","Linux"]
    browsers = ["Chrome","Firefox","Safari","Edge","Opera"]

    return [{
        "device_id": f"DEV{i:05d}",
        "device_type": random.choice(types),
        "os": random.choice(oses),
        "browser": random.choice(browsers),
    } for i in range(n)]


def gen_ips(n):
    ips, seen = [], set()
    while len(ips) < n:
        ip = fake.ipv4_public()
        if ip in seen:
            continue
        seen.add(ip)
        ips.append({
            "ip": ip,
            "country": fake.country_code(),
            "is_vpn": str(random.random() < 0.1).lower(),
            "is_tor": str(random.random() < 0.03).lower(),
        })
    return ips


def gen_transactions(accounts, n):
    txs = []
    ids = [a["account_id"] for a in accounts]
    now = datetime.now()

    for i in range(n):
        s = random.choice(ids)
        r = random.choice(ids)
        while r == s:
            r = random.choice(ids)

        burst = random.random() < 0.1

        amount = random.uniform(10, 5000)
        if burst:
            amount *= random.uniform(2, 5)

        txs.append({
            "tx_id": f"TX{i:06d}",
            "amount": round(amount, 2),
            "currency": random.choice(["USD","EUR","GBP","INR"]),
            "timestamp": (now - timedelta(days=random.randint(0,365))).isoformat(),
            "tx_type": random.choice(["transfer","payment","withdrawal","deposit"]),
            "status": random.choice(["completed","completed","completed","failed","pending"]),
            "is_fraud": "false",
            "sender": s,
            "receiver": r,
            "category": random.choice(CATEGORIES),
        })

    return txs


def embed_fraud_rings(accounts, devices, ips, transactions):
    fraud_ids = []
    shared_device_edges = []
    shared_ip_edges = []

    for ring_idx in range(N_FRAUD_RINGS):
        size = random.randint(*RING_SIZE)
        ring = random.sample(accounts, size)

        dev = random.choice(devices)
        ip = random.choice(ips)

        for acc in ring:
            acc["is_flagged"] = "true"
            acc["fraud_score"] = round(random.uniform(0.7, 1.0), 3)
            fraud_ids.append(acc["account_id"])

        for i, acc in enumerate(ring):
            nxt = ring[(i+1)%size]
            shared_device_edges.append({
                "from_account": acc["account_id"],
                "to_account": nxt["account_id"],
                "device_id": dev["device_id"],
                "count": random.randint(1,20)
            })

            nxt2 = ring[(i+2)%size]
            shared_ip_edges.append({
                "from_account": acc["account_id"],
                "to_account": nxt2["account_id"],
                "ip": ip["ip"],
                "count": random.randint(1,15)
            })

        for _ in range(size * 5):
            s = random.choice(ring)
            r = random.choice(ring)
            if s == r:
                continue

            transactions.append({
                "tx_id": f"FTX{ring_idx}_{random.randint(0,9999)}",
                "amount": round(random.uniform(500,15000),2),
                "currency": "USD",
                "timestamp": datetime.now().isoformat(),
                "tx_type": "transfer",
                "status": "completed",
                "is_fraud": "true",
                "sender": s["account_id"],
                "receiver": r["account_id"],
                "category": random.choice(["money_transfer","crypto_exchange","gambling"])
            })

    for acc in random.sample(accounts, int(len(accounts)*0.1)):
        if acc["is_flagged"] == "false":
            acc["fraud_score"] = round(random.uniform(0.3,0.7),3)

    return fraud_ids, shared_device_edges, shared_ip_edges


def write_csv(name, rows):
    if not rows:
        return
    path = os.path.join(output_dir, name)
    with open(path,"w",newline="") as f:
        w = csv.DictWriter(f, fieldnames=rows[0].keys())
        w.writeheader()
        w.writerows(rows)
    print("✓", name, len(rows))


def main():
    accounts = gen_accounts(N_ACCOUNTS)
    devices = gen_devices(N_DEVICES)
    ips = gen_ips(N_IPS)
    txs = gen_transactions(accounts, N_TRANSACTIONS)

    fraud_ids, dev_edges, ip_edges = embed_fraud_rings(accounts, devices, ips, txs)

    write_csv("accounts.csv", accounts)
    write_csv("devices.csv", devices)
    write_csv("ips.csv", ips)
    write_csv("transactions.csv", txs)
    write_csv("shares_device_edges.csv", dev_edges)
    write_csv("shares_ip_edges.csv", ip_edges)

    print("\nDONE")
    print("Accounts:", len(accounts))
    print("Transactions:", len(txs))
    print("Fraud Accounts:", len(fraud_ids))


if __name__ == "__main__":
    main()