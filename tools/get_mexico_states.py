import json
import requests

# URL of the big Mexico TopoJSON
url = "https://gist.githubusercontent.com/diegovalle/5129746/raw/mx_tj.json"

# Fetch the file
response = requests.get(url)
response.raise_for_status()
mx_topo = response.json()

# Inspect top-level objects
print("Top-level objects:", list(mx_topo.get("objects", {}).keys()))

# Only keep 'states' object
states_topo = {
    "type": mx_topo.get("type", "Topology"),
    "transform": mx_topo.get("transform"),  # keep transform if exists
    "arcs": mx_topo.get("arcs"),           # keep all arcs
    "objects": {
        "states": mx_topo["objects"]["states"]
    }
}

# Save to new TopoJSON file
with open("mx_states_only.json", "w", encoding="utf-8") as f:
    json.dump(states_topo, f)

print("Saved mx_states_only.json with only states.")
