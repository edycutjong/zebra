# Zebra ZK Payroll Circuit 🦓

This directory contains the Zero-Knowledge payroll sum and compliance circuit built with **Noir**. The circuit proves, without revealing individual salaries or employee identity secrets, that a payroll run is valid, solvent, and KYC-compliant.

## Circuit Specifications

- **Language:** Noir `1.0.0-beta.9`
- **Proof System:** Barretenberg UltraHonk `0.87.0` (using `keccak` oracle)
- **Hash primitive:** Poseidon2 (for hardware-optimal Merkle tree traversal and Protocol 26 host function compatibility on Stellar)
- **Employee Batch Size:** 4 employees (constant `N_EMPLOYEES` can be scaled)
- **Merkle Tree Depth:** 4 (constant `TREE_DEPTH`)

## Proving Constraints

The circuit enforces three distinct cryptographic constraints:
1. **Sum Correctness:** Proves that the private employee salaries sum exactly to the publicly disclosed total payroll amount.
2. **Solvency:** Asserts that the total payroll amount does not exceed the public treasury balance (`total_payroll <= treasury_balance`).
3. **KYC Membership:** Computes a Poseidon2 leaf commitment of the user's KYC secret and total payroll, traverses a Merkle path using path siblings/bits, and returns the computed `kyc_root` as a public output. The smart contract validates this root against the active compliance registry.

## Signal Map

| Parameter | Type | Visibility | Description |
|---|---|---|---|
| `total_payroll` | `Field` | **Public** | Sum total of all salaries in minor stablecoin units |
| `treasury_balance` | `Field` | **Public** | Target treasury account balance |
| `kyc_root` | `Field` (Return) | **Public** | Resulting Poseidon2 Merkle root of the compliance list |
| `salaries` | `[Field; 4]` | **Private** | Array of individual employee salary figures |
| `kyc_secret` | `Field` | **Private** | Secret entropy verifying employee compliance |
| `path_siblings` | `[Field; 4]` | **Private** | Merkle tree sibling hashes |
| `path_bits` | `[Field; 4]` | **Private** | Merkle tree routing bits (0 for left, 1 for right) |

## Development Commands

Run these commands inside the `payroll_circuit/` folder:

```bash
# Compile the circuit
nargo compile

# Run circuit unit tests
nargo test

# Generate a Solidity/Rust verifier contract
nargo codegen-verifier
```

To run a full proving run, execute the following script from the project root:
```bash
npm run prove:demo
```
