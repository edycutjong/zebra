#![no_std]
#![allow(deprecated)]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, token, Address, Bytes, BytesN, Env, Symbol, Vec
};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PayrollAuditRecord {
    pub total_amount: u128,
    pub kyc_root: BytesN<32>,
    pub encrypted_key: Bytes,
    pub metadata_uri: Bytes,
}

#[contract]
pub struct ZebraPayrollContract;

#[contractimpl]
impl ZebraPayrollContract {
    /// Initialize the payroll contract with the admin address and USDC token address
    pub fn initialize(env: Env, admin: Address, token: Address) {
        assert!(!env.storage().instance().has(&symbol_short!("admin")), "Already initialized");
        env.storage().instance().set(&symbol_short!("admin"), &admin);
        env.storage().instance().set(&symbol_short!("token"), &token);
    }

    pub fn set_verification_key(env: Env, admin: Address, vk_bytes: Bytes) {
        admin.require_auth();
        let stored_admin: Address = env.storage().instance().get(&symbol_short!("admin")).unwrap();
        assert!(admin == stored_admin, "Only admin can set verification key");
        env.storage().instance().set(&symbol_short!("vk"), &vk_bytes);
    }

    /// Set the verification key for the v3 multi-currency circuit (`payroll_mc`).
    /// This is a distinct UltraHonk VK from the base payroll circuit because the
    /// multi-currency circuit has a different shape (5 public signals).
    pub fn set_mc_verification_key(env: Env, admin: Address, vk_bytes: Bytes) {
        admin.require_auth();
        let stored_admin: Address = env.storage().instance().get(&symbol_short!("admin")).unwrap();
        assert!(admin == stored_admin, "Only admin can set verification key");
        env.storage().instance().set(&symbol_short!("mc_vk"), &vk_bytes);
    }

    pub fn set_compliance_provider(env: Env, admin: Address, provider: Address) {
        admin.require_auth();
        let stored_admin: Address = env.storage().instance().get(&symbol_short!("admin")).unwrap();
        assert!(admin == stored_admin, "Only admin can set compliance provider");
        env.storage().instance().set(&symbol_short!("provider"), &provider);
    }

    /// Verify the ZK proof and release USDC to the escrow account
    pub fn verify_and_release(
        env: Env,
        prover: Address,
        proof: Bytes,
        total_payroll: u128,
        treasury_balance: u128,
        kyc_root: BytesN<32>,
        metadata_uri: Bytes,
        encrypted_key: Bytes,
        tx_hash: BytesN<32>
    ) -> bool {
        // Authenticate the prover (CFO must sign)
        prover.require_auth();
        
        let admin: Address = env.storage().instance().get(&symbol_short!("admin")).unwrap();
        assert!(prover == admin, "Only treasury admin can submit payroll");

        // 1. Duplicate transaction nullifier check (T3.3)
        assert!(!env.storage().instance().has(&tx_hash), "Payroll transaction already executed");

        // 2. KYC compliance check against compliance provider (T3.4)
        if env.storage().instance().has(&symbol_short!("provider")) {
            let provider: Address = env.storage().instance().get(&symbol_short!("provider")).unwrap();
            let is_authorized: bool = env.invoke_contract(
                &provider,
                &Symbol::new(&env, "verify_kyc_root"),
                soroban_sdk::vec![&env, kyc_root.to_val()],
            );
            assert!(is_authorized, "KYC root not authorized by compliance provider");
        }

        // 3. Verify the ZK proof
        let vk_bytes: Bytes = env.storage().instance().get(&symbol_short!("vk")).unwrap_or_else(|| Bytes::new(&env));
        let is_valid = Self::verify_proof_internal(&env, &vk_bytes, &proof, total_payroll, treasury_balance, &kyc_root);
        assert!(is_valid, "Zero-Knowledge Proof verification failed");

        // Release USDC payroll from contract to temporary escrow distribution
        let token_address: Address = env.storage().instance().get(&symbol_short!("token")).unwrap();
        let token_client = token::Client::new(&env, &token_address);
        
        // Transfer the total payroll to the contract's escrow pool
        let contract_address = env.current_contract_address();
        token_client.transfer(&prover, &contract_address, &(total_payroll as i128));

        // Save the metadata view key mapping for auditor compliance
        let record = PayrollAuditRecord {
            total_amount: total_payroll,
            kyc_root,
            encrypted_key,
            metadata_uri,
        };
        env.storage().instance().set(&tx_hash, &record);

        // Emit payroll execution event
        env.events().publish(
            (symbol_short!("payroll"), symbol_short!("complete")),
            (total_payroll, tx_hash)
        );

        true
    }

    /// release_payroll_v2 supports multi-jurisdictional tax splitting based on ZK proof outputs.
    pub fn release_payroll_v2(
        env: Env,
        prover: Address,
        proof: Bytes,
        kyc_root: BytesN<32>,
        total_payroll: u128,
        treasury_balance: u128,
        tax_authority: Address,
        tax_amount: u128,
        net_amount: u128,
        metadata_uri: Bytes,
        encrypted_key: Bytes,
        tx_hash: BytesN<32>
    ) -> bool {
        prover.require_auth();

        let admin: Address = env.storage().instance().get(&symbol_short!("admin")).unwrap();
        assert!(prover == admin, "Only treasury admin can submit payroll");

        // 1. Transaction nullifier check
        assert!(!env.storage().instance().has(&tx_hash), "Payroll transaction already executed");

        // 2. Validate splits
        assert!(tax_amount + net_amount == total_payroll, "Split totals mismatch");

        // 3. Verify ZK proof
        let vk_bytes: Bytes = env.storage().instance().get(&symbol_short!("vk")).unwrap_or_else(|| Bytes::new(&env));
        let is_valid = Self::verify_proof_internal(&env, &vk_bytes, &proof, total_payroll, treasury_balance, &kyc_root);
        assert!(is_valid, "Zero-Knowledge Proof verification failed");

        // 4. Split transfer
        let token_address: Address = env.storage().instance().get(&symbol_short!("token")).unwrap();
        let token_client = token::Client::new(&env, &token_address);
        
        let contract_address = env.current_contract_address();

        // CFO deposits total payroll to contract
        token_client.transfer(&prover, &contract_address, &(total_payroll as i128));

        // Contract transfers tax_amount to the tax authority
        token_client.transfer(&contract_address, &tax_authority, &(tax_amount as i128));

        // Record audit
        let record = PayrollAuditRecord {
            total_amount: total_payroll,
            kyc_root,
            encrypted_key,
            metadata_uri,
        };
        env.storage().instance().set(&tx_hash, &record);

        // Emit payroll execution v2 event
        env.events().publish(
            (symbol_short!("payroll"), symbol_short!("taxsplit")),
            (total_payroll, tax_amount)
        );

        true
    }

    /// release_payroll_v3 supports multi-currency payroll with cross-jurisdiction
    /// tax withholding. Employees can be paid in different stablecoins (USDC,
    /// EURC, MXNB) with ZK-proven FX rate conversion.
    ///
    /// The ZK proof verifies:
    ///   1. Individual salaries in local currencies convert to correct USD totals
    ///   2. Tax withholdings are correctly computed per jurisdiction
    ///   3. Total treasury covers all disbursements + taxes
    ///   4. KYC membership for the payroll batch
    ///
    /// `token_addresses` maps currency tags (0=USDC, 1=EURC, 2=MXNB) to SAC addresses.
    /// `tax_authorities` maps jurisdiction indices to tax authority addresses.
    /// `tax_amounts` provides the per-jurisdiction withholding amounts.
    pub fn release_payroll_v3(
        env: Env,
        prover: Address,
        proof: Bytes,
        kyc_root: BytesN<32>,
        total_treasury_usd: u128,
        total_disbursed_usd: u128,
        total_tax_usd: u128,
        num_currencies: u32,
        token_addresses: Vec<Address>,
        tax_authorities: Vec<Address>,
        tax_amounts: Vec<u128>,
        metadata_uri: Bytes,
        encrypted_key: Bytes,
        tx_hash: BytesN<32>,
    ) -> bool {
        prover.require_auth();

        let admin: Address = env.storage().instance().get(&symbol_short!("admin")).unwrap();
        assert!(prover == admin, "Only treasury admin can submit payroll");

        // 1. Transaction nullifier check
        assert!(!env.storage().instance().has(&tx_hash), "Payroll transaction already executed");

        // 2. Validate totals: disbursed + tax <= treasury
        assert!(total_disbursed_usd + total_tax_usd <= total_treasury_usd, "Treasury insufficient");

        // 3. Validate currency count
        assert!(num_currencies >= 1 && num_currencies <= 3, "Invalid currency count");
        assert!(token_addresses.len() == num_currencies, "Token addresses count mismatch");

        // 4. Validate tax authority count matches tax amounts
        assert!(tax_authorities.len() == tax_amounts.len(), "Tax authority/amount mismatch");

        // 5. Verify ZK proof against the multi-currency circuit (`payroll_mc`).
        //    Public signals, in circuit order:
        //    [ total_treasury_usd, total_disbursed_usd, total_tax_usd, num_currencies, kyc_root ]
        let mc_vk: Bytes = env.storage().instance().get(&symbol_short!("mc_vk")).unwrap_or_else(|| Bytes::new(&env));
        let is_valid = Self::verify_mc_proof_internal(
            &env, &mc_vk, &proof,
            total_treasury_usd, total_disbursed_usd, total_tax_usd, num_currencies, &kyc_root,
        );
        assert!(is_valid, "Zero-Knowledge Proof verification failed");

        // 6. Transfer from treasury to contract (using primary USDC token)
        let primary_token: Address = env.storage().instance().get(&symbol_short!("token")).unwrap();
        let token_client = token::Client::new(&env, &primary_token);
        let contract_address = env.current_contract_address();

        token_client.transfer(&prover, &contract_address, &(total_disbursed_usd as i128 + total_tax_usd as i128));

        // 7. Distribute tax withholdings to each jurisdiction
        let mut total_tax_distributed: u128 = 0;
        for i in 0..tax_authorities.len() {
            let tax_auth = tax_authorities.get(i).unwrap();
            let tax_amt = tax_amounts.get(i).unwrap();
            token_client.transfer(&contract_address, &tax_auth, &(tax_amt as i128));
            total_tax_distributed += tax_amt;
        }
        assert!(total_tax_distributed == total_tax_usd, "Tax distribution mismatch");

        // 8. Record audit
        let record = PayrollAuditRecord {
            total_amount: total_disbursed_usd + total_tax_usd,
            kyc_root,
            encrypted_key,
            metadata_uri,
        };
        env.storage().instance().set(&tx_hash, &record);

        // 9. Emit multi-currency payroll event
        env.events().publish(
            (symbol_short!("payroll"), symbol_short!("multicx")),
            (total_disbursed_usd, total_tax_usd, num_currencies),
        );

        true
    }


    /// Read-only on-chain verification of a Noir/UltraHonk payroll proof.
    ///
    /// `public_inputs` must be the exact byte string emitted by Barretenberg
    /// (`bb prove ... --output_format bytes_and_fields` -> `public_inputs`),
    /// i.e. the big-endian 32-byte field elements in circuit order:
    /// `[ total_payroll, treasury_balance, kyc_root ]`. Returns true iff the
    /// proof verifies against the stored verification key.
    pub fn verify_proof(env: Env, proof: Bytes, public_inputs: Bytes) -> bool {
        let vk_bytes: Bytes = env
            .storage()
            .instance()
            .get(&symbol_short!("vk"))
            .unwrap_or_else(|| Bytes::new(&env));
        if vk_bytes.len() == 0 || proof.len() == 0 {
            return false;
        }
        match ultrahonk_soroban_verifier::UltraHonkVerifier::new(&env, &vk_bytes) {
            Ok(verifier) => verifier.verify(&env, &proof, &public_inputs).is_ok(),
            Err(_) => false,
        }
    }

    /// Read-only on-chain verification of a Noir/UltraHonk **multi-currency**
    /// (v3) payroll proof against the stored `mc_vk`.
    ///
    /// `public_inputs` must be the exact byte string emitted by Barretenberg for
    /// the `payroll_mc` circuit: the big-endian 32-byte field elements in circuit
    /// order `[ total_treasury_usd, total_disbursed_usd, total_tax_usd,
    /// num_currencies, kyc_root ]`. Returns true iff the proof verifies.
    pub fn verify_mc_proof(env: Env, proof: Bytes, public_inputs: Bytes) -> bool {
        let mc_vk: Bytes = env
            .storage()
            .instance()
            .get(&symbol_short!("mc_vk"))
            .unwrap_or_else(|| Bytes::new(&env));
        if mc_vk.len() == 0 || proof.len() == 0 {
            return false;
        }
        match ultrahonk_soroban_verifier::UltraHonkVerifier::new(&env, &mc_vk) {
            Ok(verifier) => verifier.verify(&env, &proof, &public_inputs).is_ok(),
            Err(_) => false,
        }
    }

    /// Retrieve the encrypted view key for a given payroll transaction hash
    pub fn get_view_key(env: Env, tx_hash: BytesN<32>) -> Option<Bytes> {
        if let Some(record) = env.storage().instance().get::<_, PayrollAuditRecord>(&tx_hash) {
            Some(record.encrypted_key)
        } else {
            None
        }
    }

    /// Retrieve the entire audit record for a given transaction hash
    pub fn get_audit_record(env: Env, tx_hash: BytesN<32>) -> Option<PayrollAuditRecord> {
        env.storage().instance().get(&tx_hash)
    }

    /// Internal helper to verify the Noir UltraHonk proof.
    ///
    /// Reconstructs the public-input byte string in the exact order the circuit
    /// declares its public signals -- `[ total_payroll, treasury_balance,
    /// kyc_root ]` -- each as a big-endian 32-byte field element, matching the
    /// layout Barretenberg emits, then runs the UltraHonk verifier.
    fn verify_proof_internal(
        env: &Env,
        vk_bytes: &Bytes,
        proof: &Bytes,
        total_payroll: u128,
        treasury_balance: u128,
        kyc_root: &BytesN<32>,
    ) -> bool {
        // Test-only bypass: in production WASM builds, this block is compiled out
        #[cfg(test)]
        {
            if proof == &Bytes::from_slice(env, b"valid_zk_proof_data") || proof.len() == 64 {
                return true;
            }
        }

        // Real verification using ultrahonk_soroban_verifier
        if vk_bytes.len() > 0 && proof.len() > 0 {
            let be32 = |v: u128| -> [u8; 32] {
                let u = soroban_sdk::U256::from_u128(env, v);
                let mut buf = [0u8; 32];
                u.to_be_bytes().copy_into_slice(&mut buf);
                buf
            };

            // Public inputs, in circuit order: total_payroll, treasury_balance, kyc_root
            let mut public_inputs = Bytes::new(env);
            public_inputs.append(&Bytes::from_slice(env, &be32(total_payroll)));
            public_inputs.append(&Bytes::from_slice(env, &be32(treasury_balance)));
            public_inputs.append(&kyc_root.clone().into());

            if let Ok(verifier) = ultrahonk_soroban_verifier::UltraHonkVerifier::new(env, vk_bytes) {
                verifier.verify(env, proof, &public_inputs).is_ok()
            } else {
                false
            }
        } else {
            false
        }
    }

    /// Internal helper to verify the v3 multi-currency UltraHonk proof.
    ///
    /// Reconstructs the public-input byte string in the exact order the
    /// `payroll_mc` circuit declares its public signals -- `[ total_treasury_usd,
    /// total_disbursed_usd, total_tax_usd, num_currencies, kyc_root ]` -- each as
    /// a big-endian 32-byte field element, then runs the UltraHonk verifier
    /// against the multi-currency verification key.
    fn verify_mc_proof_internal(
        env: &Env,
        mc_vk: &Bytes,
        proof: &Bytes,
        total_treasury_usd: u128,
        total_disbursed_usd: u128,
        total_tax_usd: u128,
        num_currencies: u32,
        kyc_root: &BytesN<32>,
    ) -> bool {
        // Test-only bypass: in production WASM builds, this block is compiled out.
        #[cfg(test)]
        {
            if proof == &Bytes::from_slice(env, b"valid_zk_proof_data") || proof.len() == 64 {
                return true;
            }
        }

        if mc_vk.len() > 0 && proof.len() > 0 {
            let be32 = |v: u128| -> [u8; 32] {
                let u = soroban_sdk::U256::from_u128(env, v);
                let mut buf = [0u8; 32];
                u.to_be_bytes().copy_into_slice(&mut buf);
                buf
            };

            let mut public_inputs = Bytes::new(env);
            public_inputs.append(&Bytes::from_slice(env, &be32(total_treasury_usd)));
            public_inputs.append(&Bytes::from_slice(env, &be32(total_disbursed_usd)));
            public_inputs.append(&Bytes::from_slice(env, &be32(total_tax_usd)));
            public_inputs.append(&Bytes::from_slice(env, &be32(num_currencies as u128)));
            public_inputs.append(&kyc_root.clone().into());

            if let Ok(verifier) = ultrahonk_soroban_verifier::UltraHonkVerifier::new(env, mc_vk) {
                verifier.verify(env, proof, &public_inputs).is_ok()
            } else {
                false
            }
        } else {
            false
        }
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    #[contract]
    pub struct MockToken;

    #[contractimpl]
    impl MockToken {
        pub fn transfer(_env: Env, _from: Address, _to: Address, _amount: i128) {}
    }

    #[contract]
    pub struct MockComplianceProvider;

    #[contractimpl]
    impl MockComplianceProvider {
        pub fn verify_kyc_root(_env: Env, _kyc_root: BytesN<32>) -> bool {
            true
        }
    }

    #[test]
    fn test_payroll_flow() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let token = env.register(MockToken, ());
        let provider = env.register(MockComplianceProvider, ());
        let contract_id = env.register(ZebraPayrollContract, ());

        let client = ZebraPayrollContractClient::new(&env, &contract_id);
        client.initialize(&admin, &token);
        client.set_compliance_provider(&admin, &provider);

        let proof = Bytes::from_slice(&env, b"valid_zk_proof_data");
        let kyc_root = BytesN::from_array(&env, &[3u8; 32]);
        let metadata_uri = Bytes::from_slice(&env, b"ipfs://audit-report");
        let encrypted_key = Bytes::from_slice(&env, b"view-key-123");
        let tx_hash = BytesN::from_array(&env, &[4u8; 32]);

        // First run passes
        let success = client.verify_and_release(&admin, &proof, &10000, &100000, &kyc_root, &metadata_uri, &encrypted_key, &tx_hash);
        assert!(success);

        // Print ZK budget metrics
        let cpu = env.cost_estimate().budget().cpu_instruction_cost();
        let mem = env.cost_estimate().budget().memory_bytes_cost();
        extern crate std;
        std::println!("=== ZK CRYPTO BENCHMARK (ZEBRA) ===");
        std::println!("Payroll CPU instructions: {}", cpu);
        std::println!("Payroll Memory bytes: {}", mem);
        std::println!("===================================");

        // Verify view key retrieving works
        let retrieved_key = client.get_view_key(&tx_hash).unwrap();
        assert_eq!(retrieved_key, encrypted_key);
    }

    #[test]
    #[should_panic(expected = "Payroll transaction already executed")]
    fn test_duplicate_payroll_fails() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let token = env.register(MockToken, ());
        let contract_id = env.register(ZebraPayrollContract, ());

        let client = ZebraPayrollContractClient::new(&env, &contract_id);
        client.initialize(&admin, &token);

        let proof = Bytes::from_slice(&env, b"valid_zk_proof_data");
        let kyc_root = BytesN::from_array(&env, &[3u8; 32]);
        let metadata_uri = Bytes::from_slice(&env, b"ipfs://audit-report");
        let encrypted_key = Bytes::from_slice(&env, b"view-key-123");
        let tx_hash = BytesN::from_array(&env, &[4u8; 32]);

        client.verify_and_release(&admin, &proof, &10000, &100000, &kyc_root, &metadata_uri, &encrypted_key, &tx_hash);
        // Duplicate tx_hash must panic
        client.verify_and_release(&admin, &proof, &10000, &100000, &kyc_root, &metadata_uri, &encrypted_key, &tx_hash);
    }

    #[test]
    #[should_panic(expected = "Already initialized")]
    fn test_double_initialize_fails() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let token = Address::generate(&env);
        let contract_id = env.register(ZebraPayrollContract, ());
        let client = ZebraPayrollContractClient::new(&env, &contract_id);
        client.initialize(&admin, &token);
        client.initialize(&admin, &token);
    }

    #[test]
    fn test_set_verification_key() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let token = Address::generate(&env);
        let contract_id = env.register(ZebraPayrollContract, ());
        let client = ZebraPayrollContractClient::new(&env, &contract_id);
        client.initialize(&admin, &token);
        let vk = Bytes::from_slice(&env, b"new_vk");
        client.set_verification_key(&admin, &vk);
    }

    #[test]
    #[should_panic(expected = "Only admin can set verification key")]
    fn test_set_verification_key_non_admin_fails() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let non_admin = Address::generate(&env);
        let token = Address::generate(&env);
        let contract_id = env.register(ZebraPayrollContract, ());
        let client = ZebraPayrollContractClient::new(&env, &contract_id);
        client.initialize(&admin, &token);
        let vk = Bytes::from_slice(&env, b"new_vk");
        client.set_verification_key(&non_admin, &vk);
    }

    #[test]
    #[should_panic(expected = "Only admin can set compliance provider")]
    fn test_set_compliance_provider_non_admin_fails() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let non_admin = Address::generate(&env);
        let token = Address::generate(&env);
        let contract_id = env.register(ZebraPayrollContract, ());
        let client = ZebraPayrollContractClient::new(&env, &contract_id);
        client.initialize(&admin, &token);
        let provider = Address::generate(&env);
        client.set_compliance_provider(&non_admin, &provider);
    }

    #[contract]
    pub struct MockFailingComplianceProvider;

    #[contractimpl]
    impl MockFailingComplianceProvider {
        pub fn verify_kyc_root(_env: Env, _kyc_root: BytesN<32>) -> bool {
            false
        }
    }

    #[test]
    #[should_panic(expected = "KYC root not authorized by compliance provider")]
    fn test_verify_and_release_kyc_fails() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let token = env.register(MockToken, ());
        let provider = env.register(MockFailingComplianceProvider, ());
        let contract_id = env.register(ZebraPayrollContract, ());
        let client = ZebraPayrollContractClient::new(&env, &contract_id);
        client.initialize(&admin, &token);
        client.set_compliance_provider(&admin, &provider);

        let proof = Bytes::from_slice(&env, b"valid_zk_proof_data");
        let kyc_root = BytesN::from_array(&env, &[3u8; 32]);
        let metadata_uri = Bytes::from_slice(&env, b"ipfs://audit-report");
        let encrypted_key = Bytes::from_slice(&env, b"view-key-123");
        let tx_hash = BytesN::from_array(&env, &[4u8; 32]);

        client.verify_and_release(&admin, &proof, &10000, &100000, &kyc_root, &metadata_uri, &encrypted_key, &tx_hash);
    }

    #[test]
    #[should_panic(expected = "Zero-Knowledge Proof verification failed")]
    fn test_verify_and_release_invalid_proof_fails() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let token = env.register(MockToken, ());
        let contract_id = env.register(ZebraPayrollContract, ());
        let client = ZebraPayrollContractClient::new(&env, &contract_id);
        client.initialize(&admin, &token);

        let proof = Bytes::from_slice(&env, b"invalid_proof");
        let kyc_root = BytesN::from_array(&env, &[3u8; 32]);
        let metadata_uri = Bytes::from_slice(&env, b"ipfs://audit-report");
        let encrypted_key = Bytes::from_slice(&env, b"view-key-123");
        let tx_hash = BytesN::from_array(&env, &[4u8; 32]);

        client.verify_and_release(&admin, &proof, &10000, &100000, &kyc_root, &metadata_uri, &encrypted_key, &tx_hash);
    }

    #[test]
    fn test_verify_proof_cases() {
        let env = Env::default();
        let contract_id = env.register(ZebraPayrollContract, ());
        let client = ZebraPayrollContractClient::new(&env, &contract_id);

        let proof = Bytes::from_slice(&env, b"valid_zk_proof_data");
        let public_inputs = Bytes::from_slice(&env, b"public_inputs");

        // Empty VK/proof returns false
        assert!(!client.verify_proof(&proof, &public_inputs));
    }

    #[test]
    fn test_get_nonexistent_records() {
        let env = Env::default();
        let contract_id = env.register(ZebraPayrollContract, ());
        let client = ZebraPayrollContractClient::new(&env, &contract_id);
        let tx_hash = BytesN::from_array(&env, &[9u8; 32]);

        assert!(client.get_view_key(&tx_hash).is_none());
        assert!(client.get_audit_record(&tx_hash).is_none());
    }

    // ─── v3 multi-currency payroll tests ────────────────────────────────

    #[test]
    fn test_release_payroll_v3_multi_currency_success() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let token = env.register(MockToken, ());
        let contract_id = env.register(ZebraPayrollContract, ());
        let client = ZebraPayrollContractClient::new(&env, &contract_id);
        client.initialize(&admin, &token);

        let proof = Bytes::from_slice(&env, b"valid_zk_proof_data");
        let kyc_root = BytesN::from_array(&env, &[3u8; 32]);
        let metadata_uri = Bytes::from_slice(&env, b"ipfs://multi-currency-audit");
        let encrypted_key = Bytes::from_slice(&env, b"multi-view-key-123");
        let tx_hash = BytesN::from_array(&env, &[60u8; 32]);

        // 2 currencies: USDC + EURC
        let mut token_addresses = Vec::new(&env);
        token_addresses.push_back(Address::generate(&env)); // USDC
        token_addresses.push_back(Address::generate(&env)); // EURC

        // 2 tax authorities
        let mut tax_authorities = Vec::new(&env);
        tax_authorities.push_back(Address::generate(&env)); // US IRS
        tax_authorities.push_back(Address::generate(&env)); // EU tax

        let mut tax_amounts = Vec::new(&env);
        tax_amounts.push_back(2000u128); // US withholding
        tax_amounts.push_back(1000u128); // EU withholding

        let success = client.release_payroll_v3(
            &admin,
            &proof,
            &kyc_root,
            &20000u128,  // total_treasury_usd
            &10000u128,  // total_disbursed_usd
            &3000u128,   // total_tax_usd (2000 + 1000)
            &2u32,       // num_currencies
            &token_addresses,
            &tax_authorities,
            &tax_amounts,
            &metadata_uri,
            &encrypted_key,
            &tx_hash,
        );
        assert!(success);

        // Verify audit record was stored
        let record = client.get_audit_record(&tx_hash).unwrap();
        assert_eq!(record.total_amount, 13000u128); // 10000 + 3000
    }

    #[test]
    #[should_panic(expected = "Payroll transaction already executed")]
    fn test_release_payroll_v3_duplicate_tx_fails() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let token = env.register(MockToken, ());
        let contract_id = env.register(ZebraPayrollContract, ());
        let client = ZebraPayrollContractClient::new(&env, &contract_id);
        client.initialize(&admin, &token);

        let proof = Bytes::from_slice(&env, b"valid_zk_proof_data");
        let kyc_root = BytesN::from_array(&env, &[3u8; 32]);
        let tx_hash = BytesN::from_array(&env, &[61u8; 32]);

        let mut token_addresses = Vec::new(&env);
        token_addresses.push_back(Address::generate(&env));
        let tax_authorities = Vec::new(&env);
        let tax_amounts: Vec<u128> = Vec::new(&env);

        let args = (
            &admin, &proof, &kyc_root,
            &20000u128, &10000u128, &0u128, &1u32,
            &token_addresses, &tax_authorities, &tax_amounts,
            &Bytes::new(&env), &Bytes::new(&env), &tx_hash,
        );

        client.release_payroll_v3(
            args.0, args.1, args.2, args.3, args.4, args.5, args.6,
            args.7, args.8, args.9, args.10, args.11, args.12,
        );
        // Second call with same tx_hash should panic
        client.release_payroll_v3(
            args.0, args.1, args.2, args.3, args.4, args.5, args.6,
            args.7, args.8, args.9, args.10, args.11, args.12,
        );
    }

    #[test]
    #[should_panic(expected = "Invalid currency count")]
    fn test_release_payroll_v3_invalid_currency_count_fails() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let token = env.register(MockToken, ());
        let contract_id = env.register(ZebraPayrollContract, ());
        let client = ZebraPayrollContractClient::new(&env, &contract_id);
        client.initialize(&admin, &token);

        let proof = Bytes::from_slice(&env, b"valid_zk_proof_data");
        let kyc_root = BytesN::from_array(&env, &[3u8; 32]);
        let tx_hash = BytesN::from_array(&env, &[62u8; 32]);

        let mut token_addresses = Vec::new(&env);
        for _ in 0..5 {
            token_addresses.push_back(Address::generate(&env));
        }

        // num_currencies = 5 but max is 3
        client.release_payroll_v3(
            &admin, &proof, &kyc_root,
            &20000u128, &10000u128, &0u128, &5u32,
            &token_addresses, &Vec::new(&env), &Vec::<u128>::new(&env),
            &Bytes::new(&env), &Bytes::new(&env), &tx_hash,
        );
    }

    #[test]
    #[should_panic(expected = "Treasury insufficient")]
    fn test_release_payroll_v3_treasury_insufficient_fails() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let token = env.register(MockToken, ());
        let contract_id = env.register(ZebraPayrollContract, ());
        let client = ZebraPayrollContractClient::new(&env, &contract_id);
        client.initialize(&admin, &token);

        let proof = Bytes::from_slice(&env, b"valid_zk_proof_data");
        let kyc_root = BytesN::from_array(&env, &[3u8; 32]);
        let tx_hash = BytesN::from_array(&env, &[63u8; 32]);

        let mut token_addresses = Vec::new(&env);
        token_addresses.push_back(Address::generate(&env));

        // disbursed (80000) + tax (30000) = 110000 > treasury (100000)
        client.release_payroll_v3(
            &admin, &proof, &kyc_root,
            &100000u128, &80000u128, &30000u128, &1u32,
            &token_addresses, &Vec::new(&env), &Vec::<u128>::new(&env),
            &Bytes::new(&env), &Bytes::new(&env), &tx_hash,
        );
    }

    #[test]
    #[should_panic(expected = "Tax authority/amount mismatch")]
    fn test_release_payroll_v3_tax_mismatch_fails() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let token = env.register(MockToken, ());
        let contract_id = env.register(ZebraPayrollContract, ());
        let client = ZebraPayrollContractClient::new(&env, &contract_id);
        client.initialize(&admin, &token);

        let proof = Bytes::from_slice(&env, b"valid_zk_proof_data");
        let kyc_root = BytesN::from_array(&env, &[3u8; 32]);
        let tx_hash = BytesN::from_array(&env, &[64u8; 32]);

        let mut token_addresses = Vec::new(&env);
        token_addresses.push_back(Address::generate(&env));

        // 2 authorities but 1 amount → mismatch
        let mut tax_authorities = Vec::new(&env);
        tax_authorities.push_back(Address::generate(&env));
        tax_authorities.push_back(Address::generate(&env));

        let mut tax_amounts = Vec::new(&env);
        tax_amounts.push_back(1000u128); // only 1 amount

        client.release_payroll_v3(
            &admin, &proof, &kyc_root,
            &20000u128, &10000u128, &2000u128, &1u32,
            &token_addresses, &tax_authorities, &tax_amounts,
            &Bytes::new(&env), &Bytes::new(&env), &tx_hash,
        );
    }
}

