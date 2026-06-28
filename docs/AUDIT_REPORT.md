# Zebra — Security & Invariants Audit Report

This report analyzes the security boundaries, threat models, and mathematical invariants of **Zebra**, the Confidential Stablecoin Payroll system.

---

## 1. System Invariants
The system enforces the following mathematical constraints on-chain and in-circuit:
1.  **Salary Conservation**: The sum of all individual employee payouts in the private CSV must match the public total payroll release value exactly.
    $$\sum_{i=1}^{n} \text{Salary}_i = \text{TotalPayroll}$$
2.  **KYC Boundary Protection**: Only addresses belonging to the verified compliance Merkle root can receive USDC disbursements.
3.  **Solvency Constraint**: The total payroll payout cannot exceed the active treasury balance of the organization.
    $$\text{TotalPayroll} \le \text{TreasuryBalance}$$

## 2. Threat Vector Analysis

### 2.1. Timing Correlation Attacks (Traffic Analysis)
*   **Vector**: Since payouts are executed in a single transaction, an on-chain observer can look at the total output USDC and monitor individual wallet balance increments during the same block to reconstruct employee salaries.
*   **Mitigation**: The treasury contract disperses USDC payouts using path payments and fixed-denomination batches across delayed intervals rather than a single concurrent multi-payment.

### 2.2. View-Key Disclosure Registry Leaks
*   **Vector**: The AES-GCM decryption key $K_{sym}$ is encrypted with the auditor's Secp256k1 public key via ECIES. If the auditor's private key is compromised, all payroll records linked to that key on IPFS can be decrypted.
*   **Mitigation**: Implement key rotation via `ViewKeyRegistry` signature-authorized updates. Each metadata package is session-encrypted with unique ephemeral keys, preventing retrospective decryption of past payroll records.

### 2.3. KYC Root Expiry Attempts
*   **Vector**: CFOs might attempt to disburse funds to employees who were recently removed from the KYC registry by submitting an outdated KYC Merkle root.
*   **Mitigation**: The smart contract asserts that `kyc_root` matches the active root or is within a 24-hour expiration window.
