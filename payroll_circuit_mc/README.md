# Zebra ZK Multi-Currency Payroll Circuit 🦓

This directory contains the Zero-Knowledge multi-currency payroll sum, cross-border compliance, and tax withholding circuit built with **Noir**. It extends the base payroll circuit (`../payroll_circuit`) with cross-jurisdiction, multi-currency conversion support and tax calculation.

The circuit proves, without revealing individual salaries, local FX rates, employee tax rates, or private KYC secrets:

1. Each employee's local currency salary converts correctly to a USD equivalent using private FX rates, and their sum matches the public `total_disbursed_usd`.
2. Individual tax withholdings match the public `total_tax_usd`.
3. The treasury has sufficient funds to cover the sum of disbursements and tax obligations (`total_disbursed_usd + total_tax_usd <= total_treasury_usd`).
4. The currency count is valid.
5. All employees are verified members of the KYC Merkle tree root.

---

## Circuit Specifications

- **Language:** Noir `1.0.0-beta.9` (or newer)
- **Proof System:** Barretenberg UltraHonk (using `keccak` oracle)
- **Hash Primitive:** Poseidon2 (for hardware-optimal Merkle tree traversal and Protocol 26 compatibility)
- **Employee Batch Size:** 4 employees (`N_EMPLOYEES = 4`)
- **Supported Currencies:** 3 distinct stablecoins (`N_CURRENCIES = 3`, Tagged as: `0 = USDC`, `1 = EURC`, `2 = MXNB`)
- **Merkle Tree Depth:** 4 (`TREE_DEPTH = 4`)

---

## Fixed-Point Scaling System

To avoid division-related security vulnerabilities and decimal truncation issues in zero-knowledge constraints, the circuit implements division-free integer math:

- **FX Rates:** Scaled by `SCALE_FX = 10000` (e.g., an exchange rate of `1.1000` USD/EUR is represented as `11000`).
- **Tax Rates:** Represented in basis points scaled by `SCALE_TAX = 10000` (e.g., `25%` tax is represented as `2500` basis points).
- **USD Conversions:** Checked at the scaled level (`USD * SCALE_FX`) to maintain soundness and precision.

---

## Proving Constraints

The circuit enforces five distinct cryptographic constraints:

1. **FX-Scaled Disbursement Correctness:** Asserts that the sum of each employee's local salary multiplied by their corresponding FX rate matches `total_disbursed_usd * SCALE_FX`.
2. **FX-Scaled Tax Correctness:** Asserts that the sum of each employee's USD-equivalent salary multiplied by their private tax rate (basis points) matches `total_tax_usd * SCALE_FX * SCALE_TAX`.
3. **Solvency:** Asserts that the total USD cost (disbursed + tax) does not exceed the public treasury balance (`total_disbursed_usd + total_tax_usd <= total_treasury_usd`).
4. **Currency Count Validation:** Verifies that the public currency count is within a valid range `[1, 3]`.
5. **KYC Membership:** Computes a Poseidon2 leaf commitment of the user's KYC secret and total payroll, traverses a Merkle path using path siblings/bits, and returns the computed `kyc_root` as a public output. The smart contract validates this root against the active compliance registry.

---

## Signal Map

| Parameter             | Type         | Visibility  | Description                                                 |
| --------------------- | ------------ | ----------- | ----------------------------------------------------------- |
| `total_treasury_usd`  | `Field`      | **Public**  | Total treasury available, in USD                            |
| `total_disbursed_usd` | `Field`      | **Public**  | Total disbursed (USD-equivalent)                            |
| `total_tax_usd`       | `Field`      | **Public**  | Total tax withheld (USD-equivalent)                         |
| `num_currencies`      | `Field`      | **Public**  | Number of distinct currencies used                          |
| `kyc_root` (Return)   | `Field`      | **Public**  | Resulting Poseidon2 Merkle root of the compliance list      |
| `salaries_local`      | `[Field; 4]` | **Private** | Array of individual employee salaries in local minor units  |
| `currency_tags`       | `[Field; 4]` | **Private** | Array of currency tags (`0 = USDC`, `1 = EURC`, `2 = MXNB`) |
| `fx_rates`            | `[Field; 3]` | **Private** | Array of FX exchange rates per currency (scaled by `10000`) |
| `tax_rates`           | `[Field; 4]` | **Private** | Array of individual tax rates in basis points               |
| `kyc_secret`          | `Field`      | **Private** | Secret entropy verifying employee compliance                |
| `path_siblings`       | `[Field; 4]` | **Private** | Merkle tree sibling hashes                                  |
| `path_bits`           | `[Field; 4]` | **Private** | Merkle tree routing bits (0 for left, 1 for right)          |

---

## Development Commands

Run these commands inside the `payroll_circuit_mc/` directory:

```bash
# Compile the circuit
nargo compile

# Run circuit unit tests
nargo test

# Generate a Solidity/Rust verifier contract
nargo codegen-verifier
```

To run a full proving run of the batch payroll system, execute the following script from the project root:

```bash
npm run prove:demo:batch
```
