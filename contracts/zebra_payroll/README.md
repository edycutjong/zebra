# Zebra Payroll Contract 🦓

A secure, zero-knowledge gated payroll distribution and auditing contract built for Stellar Soroban. This contract processes payroll disbursements by validating zk-SNARK solvency proofs before executing payouts, while storing ECIES-encrypted auditing keys for selective compliance disclosure.

## Architecture & Design
- **Language**: Rust
- **Platform**: Soroban (Stellar Smart Contracts)
- **Toolchain**: Target `wasm32-unknown-unknown` (production builds compile to `wasm32v1-none` under Rust 1.82+ to take advantage of native BN254 host functions).

## API Endpoints

### `initialize(env: Env, admin: Address, token: Address)`
Initializes the contract by setting the contract administrator and the target USDC stablecoin token address. Prevents re-initialization.

### `set_verification_key(env: Env, admin: Address, vk_bytes: Bytes)`
Updates the stored ZK verification key (UltraHonk VK bytes). Restricted to the contract administrator.

### `set_compliance_provider(env: Env, admin: Address, provider: Address)`
Sets the trusted compliance provider address responsible for verifying KYC Roots. Restricted to the contract administrator.

### `verify_and_release(env, prover, proof, total_payroll, treasury_balance, kyc_root, metadata_uri, encrypted_key, tx_hash)`
Authenticates the CFO, runs replay protection using the unique `tx_hash` nullifier, verifies the compliance status of the KYC root against the compliance registry, performs on-chain UltraHonk proof verification, transfers `total_payroll` amount of USDC from the caller into the escrow pool, and logs the audited record.

### `verify_proof(env: Env, proof: Bytes, public_inputs: Bytes) -> bool`
Pure verifier endpoint that runs UltraHonk ZK verification on-chain using native Stellar MSM host functions.

### `get_view_key(env: Env, tx_hash: BytesN<32>) -> Option<Bytes>`
Retrieves the ECIES-encrypted view key associated with the audited transaction.

### `get_audit_record(env: Env, tx_hash: BytesN<32>) -> Option<PayrollAuditRecord>`
Retrieves the complete audit record details (total amount, KYC root, encrypted view key, metadata URI) for the given transaction hash.

## Unit Testing

Run contract unit tests:
```bash
cargo test
```

### Coverage Areas
1. **Initialize validation**: Validates correct assignment of administrative roles and prevents double initialization.
2. **Access Control**: Rejects non-admin attempts to configure verification keys or compliance providers.
3. **ZK Proof Verification**: Validates correct proofs and rejects invalid or tampered inputs.
4. **KYC Compliance Checks**: Ensures transactions are rejected if the compliance provider has not verified the KYC root.
5. **Replay Protection**: Guarantees that the same transaction hash cannot be executed twice.
