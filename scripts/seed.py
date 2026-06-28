import json
import hashlib
from hashlib import sha256

# Mock Poseidon2 emulation for inputs (simplified for python seeding)
def poseidon2_mock(val1, val2, val3):
    hasher = sha256()
    hasher.update(f"{val1}-{val2}-{val3}".encode())
    return hasher.hexdigest()

employees = [
    {"name": "Alice", "id": 101, "salary": 5000000000, "salt": 82948294},
    {"name": "Bob", "id": 102, "salary": 6500000000, "salt": 19284928},
    {"name": "Charlie", "id": 103, "salary": 4200000000, "salt": 92847102},
    {"name": "Dave", "id": 104, "salary": 7800000000, "salt": 73849102}
]

def generate_tree():
    leaves = []
    for emp in employees:
        leaf_hash = poseidon2_mock(emp["id"], emp["salary"], emp["salt"])
        leaves.append(leaf_hash)
    
    # Compute Merkle Root (Depth 2 tree)
    node1 = poseidon2_mock(leaves[0], leaves[1], 0)
    node2 = poseidon2_mock(leaves[2], leaves[3], 0)
    root = poseidon2_mock(node1, node2, 0)
    
    print(f"Deterministic KYC Root: {root}")
    return root

if __name__ == "__main__":
    generate_tree()
