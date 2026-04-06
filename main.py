from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import random
import threading
import time
from collections import deque

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

nodes = {}
edges = []
mode = "normal"

def reset():
    global nodes, edges
    nodes = {}
    edges = []

def scenario_ring():
    reset()
    for i in range(6):
        nodes[i] = {"id": i, "risk": 20, "flagged": False}

    edges.extend([(0,1),(1,2),(2,3),(3,4),(4,5),(5,0)])
    nodes[0]["flagged"] = True

def scenario_cluster():
    reset()
    for i in range(10):
        nodes[i] = {"id": i, "risk": 10, "flagged": False}

    for i in range(1,10):
        edges.append((0, i))

    nodes[0]["flagged"] = True

def scenario_attack():
    reset()
    for i in range(20):
        nodes[i] = {"id": i, "risk": random.randint(10,30), "flagged": False}

    for _ in range(40):
        a = random.randint(0,19)
        b = random.randint(0,19)
        if a != b:
            edges.append((a,b))

def calculate_risk():
    for node_id in nodes:
        connections = [e for e in edges if e[0]==node_id or e[1]==node_id]

        fraud_links = sum(1 for (a,b) in connections if nodes[a]["flagged"] or nodes[b]["flagged"])

        score = nodes[node_id]["risk"] + fraud_links * 25 + len(connections)*2

        nodes[node_id]["risk"] = min(score,100)

        if nodes[node_id]["risk"] > 70:
            nodes[node_id]["flagged"] = True

def simulate():
    global mode
    while True:
        if mode == "attack":
            for _ in range(3):
                a = random.randint(0,19)
                b = random.randint(0,19)
                if a!=b:
                    edges.append((a,b))
        else:
            a = random.randint(0,19)
            b = random.randint(0,19)
            if a!=b:
                edges.append((a,b))

        if random.random() < 0.15:
            nodes[random.randint(0,len(nodes)-1)]["flagged"] = True

        calculate_risk()
        time.sleep(2)

@app.get("/graph")
def get_graph():
    return {"nodes": list(nodes.values()), "edges": edges}

@app.get("/explain/{node_id}")
def explain(node_id:int):
    connections = [e for e in edges if e[0]==node_id or e[1]==node_id]

    reasons = []
    if nodes[node_id]["risk"]>70:
        reasons.append("High risk score")

    fraud_links = sum(1 for (a,b) in connections if nodes[a]["flagged"] or nodes[b]["flagged"])
    if fraud_links>0:
        reasons.append(f"Connected to {fraud_links} suspicious accounts")

    if len(connections)>5:
        reasons.append("High transaction activity")

    return {"risk":nodes[node_id]["risk"],"reasons":reasons}

@app.get("/trace/{start}")
def trace(start:int):
    visited = set()
    queue = deque([[start]])

    while queue:
        path = queue.popleft()
        node = path[-1]

        if nodes[node]["flagged"] and node != start:
            return {"path": path}

        for (a,b) in edges:
            neighbor = None
            if a == node:
                neighbor = b
            elif b == node:
                neighbor = a

            if neighbor is not None and neighbor not in visited:
                visited.add(neighbor)
                queue.append(path + [neighbor])

    return {"path": []}

@app.get("/scenario/{name}")
def set_scenario(name:str):
    if name=="ring":
        scenario_ring()
    elif name=="cluster":
        scenario_cluster()
    else:
        scenario_attack()
    return {"status":"ok"}

@app.get("/mode/{m}")
def set_mode(m:str):
    global mode
    mode = m
    return {"mode":mode}

scenario_attack()
threading.Thread(target=simulate, daemon=True).start()