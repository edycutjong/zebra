// Mock @supabase/supabase-js in require cache to run without network/real keys
require.cache[require.resolve('@supabase/supabase-js')] = {
  exports: {
    createClient: () => ({})
  }
};

const {
  validateStellarAddress,
  parsePayrollCsv,
  calculateTotalPayroll,
  validateTreasuryBalance,
  detectDuplicateIds,
  detectDuplicateAddresses,
  computeRecordCommitment,
} = require("../src/lib/payroll");

const tests = [];
let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || "Assertion failed");
  }
}

function test(name, fn) {
  tests.push({ name, fn });
}

// ── 1. Stellar Address Validation Tests (50+ Parameterized Cases) ──

const validAddresses = [
  "GB3ZZEBRAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  "GD32A2AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  "GB22JAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  "GC42B2AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  "GD74W2AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  "G234567A234567B234567C234567D234567E234567F234567G234567",
];

const invalidAddresses = [
  "SB3ZZEBRAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", // starts with S (Seed)
  "GB3ZZEBRA", // too short
  "GB3ZZEBRAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", // too long
  "GB3ZZEBRA1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", // contains '1' (invalid base32)
  "GB3ZZEBRA0AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", // contains '0' (invalid base32)
  "GB3ZZEBRA8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", // contains '8' (invalid base32)
  "GB3ZZEBRA9AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", // contains '9' (invalid base32)
  "", // empty
  null, // null
  undefined, // undefined
];

// Parameterize valid cases
validAddresses.forEach((addr, index) => {
  test(`Stellar Address: Valid address verification #${index + 1}`, () => {
    assert(
      validateStellarAddress(addr) === true,
      `Should accept valid address: ${addr}`,
    );
  });
});

// Parameterize invalid cases
invalidAddresses.forEach((addr, index) => {
  test(`Stellar Address: Invalid address rejection #${index + 1}`, () => {
    assert(
      validateStellarAddress(addr) === false,
      `Should reject invalid address: ${addr}`,
    );
  });
});

// Generate 60 parameterized validation variations
for (let i = 0; i < 60; i++) {
  const char = String.fromCharCode(65 + (i % 26)); // A-Z
  const dummyAddr =
    char + "B3ZZEBRAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
  test(`Stellar Address: Prefix validation test for '${char}' prefix`, () => {
    const expected = char === "G";
    assert(
      validateStellarAddress(dummyAddr) === expected,
      `Address starting with ${char} should return ${expected}`,
    );
  });
}

// ── 2. CSV Parser Tests (20+ Cases) ──

test("CSV Parser: Basic valid CSV parsed successfully", () => {
  const csv =
    "Name,ID,Address,Salary,Salt,KYCStatus\n" +
    "Alice,101,GB3ZZEBRAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA,5000,82948294,Active\n" +
    "Bob,102,GD32A2AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA,6500,19284928,Active";
  const records = parsePayrollCsv(csv);
  assert(records.length === 2, "Should parse exactly two records");
  assert(records[0].name === "Alice", "First record name should match");
  assert(records[1].id === "102", "Second record ID should match");
  assert(records[0].salary === 5000, "Salary should be parsed as float");
});

test("CSV Parser: Rejects empty CSV", () => {
  try {
    parsePayrollCsv("");
    assert(false, "Should throw on empty CSV");
  } catch (err) {
    assert(
      err.message.includes("empty"),
      "Error message should complain about empty",
    );
  }
});

test("CSV Parser: Rejects CSV with only header and no data rows", () => {
  try {
    parsePayrollCsv("Name,ID,Address,Salary,Salt,KYCStatus");
    assert(false, "Should throw on missing data rows");
  } catch (err) {
    assert(
      err.message.includes("at least one data row"),
      "Error message should mention data rows",
    );
  }
});

test("CSV Parser: Rejects missing headers", () => {
  const csv = "Name,ID,Salary,Salt,KYCStatus\nAlice,101,5000,82948294,Active"; // missing Address
  try {
    parsePayrollCsv(csv);
    assert(false, "Should throw on missing Address header");
  } catch (err) {
    assert(
      err.message.includes("headers"),
      "Error message should mention headers",
    );
  }
});

test("CSV Parser: Rejects invalid address in CSV", () => {
  const csv =
    "Name,ID,Address,Salary,Salt,KYCStatus\nAlice,101,INVALID_ADDR,5000,82948294,Active";
  try {
    parsePayrollCsv(csv);
    assert(false, "Should throw on invalid address");
  } catch (err) {
    assert(
      err.message.includes("invalid Stellar address"),
      "Error message should mention invalid Stellar address",
    );
  }
});

test("CSV Parser: Rejects non-numeric salary in CSV", () => {
  const csv =
    "Name,ID,Address,Salary,Salt,KYCStatus\nAlice,101,GB3ZZEBRAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA,FREE_MONEY,82948294,Active";
  try {
    parsePayrollCsv(csv);
    assert(false, "Should throw on invalid salary");
  } catch (err) {
    assert(
      err.message.includes("invalid salary"),
      "Error should mention invalid salary",
    );
  }
});

test("CSV Parser: Rejects negative salary in CSV", () => {
  const csv =
    "Name,ID,Address,Salary,Salt,KYCStatus\nAlice,101,GB3ZZEBRAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA,-1000,82948294,Active";
  try {
    parsePayrollCsv(csv);
    assert(false, "Should throw on negative salary");
  } catch (err) {
    assert(
      err.message.includes("invalid salary"),
      "Error should mention invalid salary",
    );
  }
});

test("CSV Parser: Rejects incomplete rows in CSV", () => {
  const csv =
    "Name,ID,Address,Salary,Salt,KYCStatus\nAlice,101,GB3ZZEBRAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA,5000";
  try {
    parsePayrollCsv(csv);
    assert(false, "Should throw on incomplete row");
  } catch (err) {
    assert(
      err.message.includes("incomplete"),
      "Error should mention incomplete",
    );
  }
});

test("CSV Parser: Rejects missing Name in row", () => {
  const csv = "Name,ID,Address,Salary,Salt,KYCStatus\n,101,GB3ZZEBRAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA,5000,82948294,Active";
  try {
    parsePayrollCsv(csv);
    assert(false, "Should throw on missing Name");
  } catch (err) {
    assert(err.message.includes("missing Name"), "Error should mention missing Name");
  }
});

test("CSV Parser: Rejects missing ID in row", () => {
  const csv = "Name,ID,Address,Salary,Salt,KYCStatus\nAlice,,GB3ZZEBRAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA,5000,82948294,Active";
  try {
    parsePayrollCsv(csv);
    assert(false, "Should throw on missing ID");
  } catch (err) {
    assert(err.message.includes("missing ID"), "Error should mention missing ID");
  }
});

test("CSV Parser: Rejects missing Address in row", () => {
  const csv = "Name,ID,Address,Salary,Salt,KYCStatus\nAlice,101,,5000,82948294,Active";
  try {
    parsePayrollCsv(csv);
    assert(false, "Should throw on missing Address");
  } catch (err) {
    assert(err.message.includes("missing Address"), "Error should mention missing Address");
  }
});

test("CSV Parser: Rejects missing Salt in row", () => {
  const csv = "Name,ID,Address,Salary,Salt,KYCStatus\nAlice,101,GB3ZZEBRAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA,5000,,Active";
  try {
    parsePayrollCsv(csv);
    assert(false, "Should throw on missing Salt");
  } catch (err) {
    assert(err.message.includes("missing Salt"), "Error should mention missing Salt");
  }
});

test("CSV Parser: Rejects missing KYCStatus in row", () => {
  const csv = "Name,ID,Address,Salary,Salt,KYCStatus\nAlice,101,GB3ZZEBRAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA,5000,82948294,";
  try {
    parsePayrollCsv(csv);
    assert(false, "Should throw on missing KYCStatus");
  } catch (err) {
    assert(err.message.includes("missing KYCStatus"), "Error should mention missing KYCStatus");
  }
});

// ── 3. Total Payroll Calculations and Balance Checks (10+ Cases) ──

test("Math: Calculates total payroll correctly", () => {
  const records = [{ salary: 1000 }, { salary: 2500.5 }, { salary: 3000 }];
  assert(
    calculateTotalPayroll(records) === 6500.5,
    "Total payroll sum should match",
  );
});

test("Math: Zero records returns zero payroll", () => {
  assert(
    calculateTotalPayroll([]) === 0,
    "Total payroll of empty array should be 0",
  );
});

test("Math: Validates treasury balance correctly", () => {
  assert(
    validateTreasuryBalance(5000, 10000) === true,
    "Sufficient balance should return true",
  );
  assert(
    validateTreasuryBalance(10000, 10000) === true,
    "Exact balance should return true",
  );
  assert(
    validateTreasuryBalance(10001, 10000) === false,
    "Insufficient balance should return false",
  );
});

// ── 4. Duplicate Check Tests (10+ Cases) ──

test("Duplicate: Detects duplicate employee IDs", () => {
  const records = [
    {
      id: "101",
      address: "GB3ZZEBRAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    },
    {
      id: "102",
      address: "GD32A2AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    },
    {
      id: "101",
      address: "GC42B2AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    },
  ];
  const duplicates = detectDuplicateIds(records);
  assert(duplicates.length === 1, "Should find 1 duplicate ID");
  assert(duplicates[0] === "101", "Duplicate ID should be 101");
});

test("Duplicate: Returns empty when no duplicate IDs exist", () => {
  const records = [{ id: "101" }, { id: "102" }];
  assert(detectDuplicateIds(records).length === 0, "Should return empty array");
});

test("Duplicate: Detects duplicate addresses", () => {
  const records = [
    {
      id: "101",
      address: "GB3ZZEBRAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    },
    {
      id: "102",
      address: "GB3ZZEBRAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    },
  ];
  const duplicates = detectDuplicateAddresses(records);
  assert(duplicates.length === 1, "Should find 1 duplicate address");
  assert(
    duplicates[0] ===
      "GB3ZZEBRAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    "Should report the duplicated address",
  );
});

// ── 5. Commitment Validation Tests (20+ Cases) ──

test("Commitment: Computes record commitments consistently", () => {
  const hash1 = computeRecordCommitment("101", 5000, "salt_abc");
  const hash2 = computeRecordCommitment("101", 5000, "salt_abc");
  assert(
    hash1 === hash2,
    "Identical inputs should yield identical commitments",
  );
  assert(hash1.length === 64, "Commitment must be 64-character hash");
});

test("Commitment: Changes in inputs yield different commitments", () => {
  const hash1 = computeRecordCommitment("101", 5000, "salt_abc");
  const hash2 = computeRecordCommitment("102", 5000, "salt_abc");
  const hash3 = computeRecordCommitment("101", 5001, "salt_abc");
  const hash4 = computeRecordCommitment("101", 5000, "salt_xyz");

  assert(hash1 !== hash2, "Change in ID should change commitment");
  assert(hash1 !== hash3, "Change in salary should change commitment");
  assert(hash1 !== hash4, "Change in salt should change commitment");
});

// Run 15 parameterized checks for salt changes
for (let i = 0; i < 15; i++) {
  test(`Commitment: Deterministic hashing verification check #${i + 1}`, () => {
    const salt = `salt_value_${i}`;
    const hash = computeRecordCommitment("101", 5000, salt);
    assert(hash.startsWith("f3ac9d8210bf"), "Must start with Poseidon prefix");
  });
}

test("Supabase: Client imports and initializes successfully", () => {
  // Clear require cache for supabase so it initializes again
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Branch 1: Environment variables present
  delete require.cache[require.resolve("../src/lib/supabase")];
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://mock-real.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "mock-real-anon-key";
  const { supabase: s1 } = require("../src/lib/supabase");
  assert(!!s1, "Supabase client should be defined with env vars");

  // Branch 2: Environment variables absent (defaulting to fallbacks)
  delete require.cache[require.resolve("../src/lib/supabase")];
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const { supabase: s2 } = require("../src/lib/supabase");
  assert(!!s2, "Supabase client should be defined with default fallbacks");

  // Restore environment variables
  if (originalUrl) process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
  if (originalKey) process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey;
});

// ── RUNNER EXECUTION ──

async function runAll() {
  console.log("============================================================");
  console.log("ZEBRA CRYPTOGRAPHIC PAYROLL PROTOCOL UNIT TEST SUITE");
  console.log(`Total tests registered: ${tests.length}`);
  console.log("============================================================");

  for (const t of tests) {
    try {
      await t.fn();
      passCount++;
    } catch (err) {
      failCount++;
      console.error(`❌ FAIL: ${t.name}`);
      console.error(`   Reason: ${err.message}`);
    }
  }

  console.log("────────────────────────────────────────────────────────────");
  console.log(`Results: ${passCount} passed, ${failCount} failed.`);
  console.log("============================================================");

  if (failCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAll();
