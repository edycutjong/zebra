// Zebra v3 - Multi-Currency Payroll circuit (Noir 1.0 / UltraHonk via Barretenberg)
//
// Extends the base payroll circuit (../payroll_circuit) with cross-jurisdiction,
// multi-currency support. Proves, without revealing individual salaries, FX rates
// or the KYC secret:
//   1. Each employee's salary in a local stablecoin (USDC/EURC/MXNB) converts to a
//      USD-equivalent at a private FX rate, and the converted amounts sum to the
//      public `total_disbursed_usd`.
//   2. Per-employee tax withholdings (basis points) sum to the public
//      `total_tax_usd`.
//   3. Solvency: `total_disbursed_usd + total_tax_usd <= total_treasury_usd`.
//   4. The declared `num_currencies` is a valid count in [1, N_CURRENCIES].
//   5. KYC membership: the payroll's commitment is a leaf of a Poseidon2 Merkle
//      tree whose root is returned as a public output.
//
// Public signals (in order, as emitted by `bb` for the on-chain verifier):
//   [ total_treasury_usd, total_disbursed_usd, total_tax_usd, num_currencies, kyc_root ]
//
// Fixed-point scaling: FX rates are scaled by SCALE_FX (1e4), tax rates are basis
// points scaled by SCALE_TAX (1e4). All cross-products are checked at the most
// scaled level to keep the constraints division-free and sound.

use dep::poseidon::poseidon2::Poseidon2;

global TREE_DEPTH: u32 = 4;
global N_EMPLOYEES: u32 = 4;
global N_CURRENCIES: u32 = 3;
global SCALE_FX: Field = 10000; // FX rate scale (1.0 == 10000)
global SCALE_TAX: Field = 10000; // tax basis-point scale (100% == 10000)

fn hash2(a: Field, b: Field) -> Field {
    Poseidon2::hash([a, b], 2)
}

fn main(
    // Public inputs
    total_treasury_usd: pub Field, // total treasury available, in USD
    total_disbursed_usd: pub Field, // total disbursed (USD-equivalent)
    total_tax_usd: pub Field, // total tax withheld (USD-equivalent)
    num_currencies: pub Field, // number of distinct currencies used
    // Private inputs
    salaries_local: [Field; N_EMPLOYEES], // salary in local currency minor units
    currency_tags: [Field; N_EMPLOYEES], // 0=USDC, 1=EURC, 2=MXNB
    fx_rates: [Field; N_CURRENCIES], // FX rate per currency (scaled by SCALE_FX)
    tax_rates: [Field; N_EMPLOYEES], // tax rate per employee (basis points)
    kyc_secret: Field,
    path_siblings: [Field; TREE_DEPTH],
    path_bits: [Field; TREE_DEPTH],
) -> pub Field {
    let mut computed_disbursed_fx: Field = 0; // scaled by SCALE_FX
    let mut computed_tax_fxtax: Field = 0; // scaled by SCALE_FX * SCALE_TAX

    for i in 0..N_EMPLOYEES {
        let tag = currency_tags[i] as u64;
        assert(tag < N_CURRENCIES as u64);

        // Select the FX rate for this employee's currency tag.
        let mut rate: Field = fx_rates[0];
        for c in 0..N_CURRENCIES {
            if (c as u64) == tag {
                rate = fx_rates[c];
            }
        }

        // USD-equivalent (scaled by SCALE_FX) and tax (scaled by SCALE_FX*SCALE_TAX).
        let usd_fx = salaries_local[i] * rate;
        let tax_fxtax = usd_fx * tax_rates[i];

        computed_disbursed_fx += usd_fx;
        computed_tax_fxtax += tax_fxtax;

        // Salary must be positive; tax rate must be a valid basis-point fraction.
        assert(salaries_local[i] as u64 > 0);
        assert(tax_rates[i] as u64 <= 10000);
    }

    // 1. Disbursement total consistency (compare at the SCALE_FX level).
    assert(computed_disbursed_fx == total_disbursed_usd * SCALE_FX);

    // 2. Tax total consistency (compare at the SCALE_FX*SCALE_TAX level).
    assert(computed_tax_fxtax == total_tax_usd * SCALE_FX * SCALE_TAX);

    // 3. Solvency: treasury covers disbursement + tax.
    let total_cost = total_disbursed_usd + total_tax_usd;
    assert(total_cost as u64 <= total_treasury_usd as u64);

    // 4. Currency count validation.
    assert(num_currencies as u64 >= 1);
    assert(num_currencies as u64 <= N_CURRENCIES as u64);

    // 5. KYC membership (same Merkle proof as base circuit).
    let leaf = hash2(kyc_secret, total_disbursed_usd);
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
fn test_multi_currency_payroll() {
    // 4 employees across 3 currencies:
    //   e0: 2500 USDC  @1.0000 -> 2500 USD, tax 20% ->  500
    //   e1: 2000 EURC  @1.1000 -> 2200 USD, tax 25% ->  550
    //   e2: 100000 MXNB@0.0600 -> 6000 USD, tax 15% ->  900
    //   e3: 1500 USDC  @1.0000 -> 1500 USD, tax 10% ->  150
    // disbursed = 12200 USD, tax = 2100 USD, treasury = 15000 USD.
    let root = main(
        15000, // total_treasury_usd
        12200, // total_disbursed_usd
        2100, // total_tax_usd
        3, // num_currencies
        [2500, 2000, 100000, 1500], // salaries_local
        [0, 1, 2, 0], // currency_tags
        [10000, 11000, 600], // fx_rates (scaled by 1e4)
        [2000, 2500, 1500, 1000], // tax_rates (basis points)
        12345, // kyc_secret
        [1, 2, 3, 4], // path_siblings
        [0, 1, 0, 1], // path_bits
    );
    assert(root != 0);
}
