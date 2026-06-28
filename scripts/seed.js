const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const { createClient } = require("@supabase/supabase-js");
const crypto = require("crypto");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Error: Supabase environment variables are missing!");
  process.exit(1);
}

// Provide a mock WebSocket constructor to satisfy RealtimeClient initialization in Node < 20
if (typeof global.WebSocket === "undefined") {
  global.WebSocket = class {};
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const employees = [
  { name: "Alice", id: 101, salary: 5000000000, salt: 82948294 },
  { name: "Bob", id: 102, salary: 6500000000, salt: 19284928 },
  { name: "Charlie", id: 103, salary: 4200000000, salt: 92847102 },
  { name: "Dave", id: 104, salary: 7800000000, salt: 73849102 },
];

function poseidon2Mock(val1, val2, val3) {
  const hasher = crypto.createHash("sha256");
  hasher.update(`${val1}-${val2}-${val3}`);
  return hasher.digest("hex");
}

async function seed() {
  console.log("Generating deterministic KYC Merkle Root...");

  const leaves = employees.map((emp) =>
    poseidon2Mock(emp.id, emp.salary, emp.salt),
  );

  const node1 = poseidon2Mock(leaves[0], leaves[1], 0);
  const node2 = poseidon2Mock(leaves[2], leaves[3], 0);
  const root = poseidon2Mock(node1, node2, 0);

  console.log(`Deterministic KYC Root: ${root}`);

  console.log("Seeding Supabase tables for Zebra...");

  // 1. Clean old entries to prevent unique constraint failures
  try {
    await supabase
      .from("zebra_tax_records")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
  } catch (e) {
    console.warn(
      "Warning: Could not clean old zebra_tax_records. Continuing...",
    );
  }
  try {
    await supabase
      .from("zebra_payroll_audits")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
  } catch (e) {
    console.warn(
      "Warning: Could not clean old zebra_payroll_audits. Continuing...",
    );
  }

  // 2. Insert payroll audits
  const txHash = crypto.randomBytes(32).toString("hex");
  const { data: auditData, error: auditError } = await supabase
    .from("zebra_payroll_audits")
    .insert([
      {
        tx_hash: txHash,
        total_amount: 23500.0,
        kyc_root: root,
        encrypted_view_key:
          "04a3b8d4f6c9e0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef012",
        metadata_uri: "ipfs://QmZebraPayrollAuditMetadataHash1234567890",
      },
    ])
    .select();

  if (auditError) {
    if (auditError.code === "23505") {
      console.log("Audit record with this tx_hash already exists (seeded).");
    } else {
      console.error("Error inserting payroll audits:", auditError);
      process.exit(1);
    }
  }

  console.log("Seeded zebra_payroll_audits:", auditData);

  // 3. Insert tax records
  try {
    const { data: taxData, error: taxError } = await supabase
      .from("zebra_tax_records")
      .insert([
        {
          payroll_hash: txHash,
          tax_authority:
            "GDTAXAUTHORITYXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
          tax_amount: 3500.0,
          net_amount: 20000.0,
          status: "complete",
        },
      ])
      .select();

    if (taxError) {
      console.warn(
        "Warning: Could not seed zebra_tax_records (possibly table needs to be created):",
        taxError.message,
      );
    } else {
      console.log("Seeded zebra_tax_records:", taxData);
    }
  } catch (err) {
    console.warn(
      "Warning: Error inserting into zebra_tax_records:",
      err.message,
    );
  }

  console.log("Zebra database seeding completed.");
}

seed().catch((err) => {
  console.error("Unexpected seeding error:", err);
  process.exit(1);
});
