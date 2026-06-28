// End-to-end REAL proving demo for Zebra's v3 multi-currency payroll:
//   Noir circuit (payroll_circuit_mc: multi-currency FX + tax withholding +
//   Poseidon2 KYC membership) -> nargo execute -> Barretenberg UltraHonk proof
//   (keccak oracle) -> on-chain verify_mc_proof on the deployed Soroban contract
//   (real rs-soroban-ultrahonk verification against the multi-currency VK).
//   Tampered public inputs are rejected.
//
// Public signals (circuit order):
//   [ total_treasury_usd, total_disbursed_usd, total_tax_usd, num_currencies, kyc_root ]
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const CIRC = resolve(ROOT, "payroll_circuit_mc");
const TARGET = resolve(CIRC, "target");
const HOME = process.env.HOME;
const PATH = `${HOME}/.nargo/bin:${HOME}/.bb:${HOME}/homebrew/bin:${process.env.PATH}`;
const ENV = { ...process.env, PATH };
const ID =
  process.env.ZEBRA_MC_CONTRACT_ID ||
  "CBXJ75PDFAMMGL2VHEXBJX2UT3GSWPHEZZULOFZWUZLN57V6UUBOL6NB";

const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, {
    encoding: "utf8",
    env: ENV,
    cwd: CIRC,
    stdio: ["ignore", "pipe", "inherit"],
    ...opts,
  });
const hex = (p) => readFileSync(p).toString("hex");

console.log("Compiling multi-currency Noir circuit + solving witness...");
run("nargo", ["compile"]);
run("nargo", ["execute"]);

console.log("Generating real UltraHonk proof (Barretenberg, keccak oracle)...");
run("bb", [
  "prove",
  "--scheme",
  "ultra_honk",
  "--oracle_hash",
  "keccak",
  "--bytecode_path",
  `${TARGET}/payroll_mc.json`,
  "--witness_path",
  `${TARGET}/payroll_mc.gz`,
  "--output_path",
  TARGET,
  "--output_format",
  "bytes_and_fields",
]);
run("bb", [
  "write_vk",
  "--scheme",
  "ultra_honk",
  "--oracle_hash",
  "keccak",
  "--bytecode_path",
  `${TARGET}/payroll_mc.json`,
  "--output_path",
  TARGET,
  "--output_format",
  "bytes_and_fields",
]);

console.log(
  "off-chain verify:",
  run("bb", [
    "verify",
    "--scheme",
    "ultra_honk",
    "--oracle_hash",
    "keccak",
    "--proof_path",
    `${TARGET}/proof`,
    "--vk_path",
    `${TARGET}/vk`,
    "--public_inputs_path",
    `${TARGET}/public_inputs`,
  ]).includes("verified successfully") || "(see output)",
);

const proof = hex(`${TARGET}/proof`);
const publicInputs = hex(`${TARGET}/public_inputs`);

console.log(`Submitting on-chain verify_mc_proof to ${ID} ...`);
const out = run(
  "stellar",
  [
    "contract",
    "invoke",
    "--id",
    ID,
    "--source",
    "deployer",
    "--network",
    "testnet",
    "--",
    "verify_mc_proof",
    "--proof",
    proof,
    "--public_inputs",
    publicInputs,
  ],
  { stdio: ["ignore", "pipe", "pipe"] },
);
const result = out.trim().split("\n").pop().trim();
console.log("on-chain verify_mc_proof =>", result);
if (result !== "true") process.exit(1);

// negative control: tamper total_treasury_usd field -> must be rejected
const bad = "f" + publicInputs.slice(1);
const out2 = run(
  "stellar",
  [
    "contract",
    "invoke",
    "--id",
    ID,
    "--source",
    "deployer",
    "--network",
    "testnet",
    "--",
    "verify_mc_proof",
    "--proof",
    proof,
    "--public_inputs",
    bad,
  ],
  { stdio: ["ignore", "pipe", "pipe"] },
);
const tampered = out2.trim().split("\n").pop().trim();
console.log("on-chain verify_mc_proof (tampered) =>", tampered);
if (tampered === "true") {
  console.error("tampered proof accepted!");
  process.exit(1);
}

console.log(
  "\n✅ Real Noir/UltraHonk multi-currency payroll proof verified on-chain; tampered proof rejected.",
);
