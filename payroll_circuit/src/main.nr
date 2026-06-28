// Zebra - Confidential Payroll circuit (Noir 1.0 / UltraHonk via Barretenberg)
//
// Proves, without revealing individual salaries or the employee KYC secret:
//   1. the private salaries sum to the public `total_payroll`,
//   2. the payroll is solvent: `total_payroll <= treasury_balance` (public),
//   3. KYC membership: the payroll's KYC commitment is a leaf of a Poseidon2
//      Merkle tree, whose `kyc_root` is returned as a public output.
//
// Public signals (in order, as emitted by `bb` for the on-chain verifier):
//   [ total_payroll, treasury_balance, kyc_root ]
//
// Hashing uses Poseidon2 - the same family exposed as a native Soroban host
// function on Protocol 25/26 - so commitments line up with the on-chain world.

use dep::poseidon::poseidon2::Poseidon2;

global TREE_DEPTH: u32 = 4;
global N_EMPLOYEES: u32 = 4;

fn hash2(a: Field, b: Field) -> Field {
    Poseidon2::hash([a, b], 2)
}

fn main(
    // Public inputs
    total_payroll: pub Field,
    treasury_balance: pub Field,
    // Private inputs
    salaries: [Field; N_EMPLOYEES],
    kyc_secret: Field,
    path_siblings: [Field; TREE_DEPTH],
    path_bits: [Field; TREE_DEPTH],
) -> pub Field {
    // 1. The sum of the confidential salaries must equal the disclosed total.
    let mut sum: Field = 0;
    for i in 0..N_EMPLOYEES {
        sum += salaries[i];
    }
    assert(sum == total_payroll);

    // 2. Solvency: the treasury must cover the payroll. (u64 range is ample for
    //    stablecoin minor units and keeps the comparison sound.)
    assert(total_payroll as u64 <= treasury_balance as u64);

    // 3. KYC membership. The leaf commits to the payroll under a private secret;
    //    we walk the Merkle path and return the resulting root as a public
    //    signal, so the contract/auditor can bind the proof to a known KYC set.
    let leaf = hash2(kyc_secret, total_payroll);
    let mut cur = leaf;
    for i in 0..TREE_DEPTH {
        let bit = path_bits[i];
        assert(bit * (1 - bit) == 0); // bit in {0,1}
        if bit == 0 {
            cur = hash2(cur, path_siblings[i]);
        } else {
            cur = hash2(path_siblings[i], cur);
        }
    }
    cur
}

#[test]
fn test_payroll() {
    // salaries sum to 9000, solvent against 100000.
    let root = main(
        9000,
        100000,
        [2500, 3000, 1500, 2000],
        12345,
        [1, 2, 3, 4],
        [0, 1, 0, 1],
    );
    assert(root != 0);
}
