// End-to-end REAL proving demo for Zebra's confidential payroll:
//   Noir circuit (Poseidon2 Merkle membership + salary-sum + solvency)
//   -> nargo execute -> Barretenberg UltraHonk proof (keccak oracle)
//   -> on-chain verify_proof on the deployed Soroban contract (real
//      rs-soroban-ultrahonk verification). Tampered public inputs are rejected.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const CIRC = resolve(ROOT, "payroll_circuit");
const TARGET = resolve(CIRC, "target");
const HOME = process.env.HOME;
const PATH = `${HOME}/.nargo/bin:${HOME}/.bb:${HOME}/homebrew/bin:${process.env.PATH}`;
const ENV = { ...process.env, PATH };
const ID =
  process.env.ZEBRA_CONTRACT_ID ||
  "CCLTVNPYS5H2AY4OTYIYDU57XYO4S5OZQE435ZZX2TFUVYDAIS6B53N5";

const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, {
    encoding: "utf8",
    env: ENV,
    cwd: CIRC,
    stdio: ["ignore", "pipe", "inherit"],
    ...opts,
  });
const hex = (p) => readFileSync(p).toString("hex");

console.log("Compiling Noir circuit + solving witness...");
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
  `${TARGET}/payroll_circuit.json`,
  "--witness_path",
  `${TARGET}/payroll_circuit.gz`,
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
  `${TARGET}/payroll_circuit.json`,
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

console.log(`Submitting on-chain verify_proof to ${ID} ...`);
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
    "--send=yes",
    "--",
    "verify_proof",
    "--proof",
    proof,
    "--public_inputs",
    publicInputs,
  ],
  { stdio: ["ignore", "pipe", "pipe"] },
);
const result = out.trim().split("\n").pop().trim();
console.log("on-chain verify_proof =>", result);
if (result !== "true") process.exit(1);

// negative control: tamper total_payroll field -> must be rejected
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
    "verify_proof",
    "--proof",
    proof,
    "--public_inputs",
    bad,
  ],
  { stdio: ["ignore", "pipe", "pipe"] },
);
const tampered = out2.trim().split("\n").pop().trim();
console.log("on-chain verify_proof (tampered) =>", tampered);
if (tampered === "true") {
  console.error("tampered proof accepted!");
  process.exit(1);
}

console.log(
  "\n✅ Real Noir/UltraHonk payroll proof verified on-chain; tampered proof rejected.",
);
