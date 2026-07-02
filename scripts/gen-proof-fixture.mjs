// Reads the real Barretenberg UltraHonk payroll proof (produced by
// prove:demo / bb) and confirms it verifies TRUE on the deployed contract via
// read-only JS simulation, then writes it as a static fixture the web app
// re-verifies on-chain live.
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  rpc,
  TransactionBuilder,
  Networks,
  Contract,
  nativeToScVal,
  Account,
  scValToNative,
} from "@stellar/stellar-sdk";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TARGET = resolve(__dirname, "../payroll_circuit/target");
const OUT = resolve(__dirname, "../src/app/api/verify-onchain/proof.json");
const ID =
  process.env.ZEBRA_CONTRACT_ID ||
  "CCLTVNPYS5H2AY4OTYIYDU57XYO4S5OZQE435ZZX2TFUVYDAIS6B53N5";
const hex = (p) => readFileSync(p).toString("hex");

async function verify(proofHex, publicInputsHex) {
  const server = new rpc.Server("https://soroban-testnet.stellar.org");
  const contract = new Contract(ID);
  const call = contract.call(
    "verify_proof",
    nativeToScVal(Buffer.from(proofHex, "hex")),
    nativeToScVal(Buffer.from(publicInputsHex, "hex")),
  );
  const source = "GAZV4ZZRKEWHOHWSVKLX7VZVDGJ6GAVSPHMFDBYMS6WQ74DBYP3FOMMX";
  const tx = new TransactionBuilder(new Account(source, "0"), {
    fee: "100",
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(call)
    .setTimeout(30)
    .build();
  const sim = await server.simulateTransaction(tx);
  return (
    rpc.Api.isSimulationSuccess(sim) &&
    String(scValToNative(sim.result.retval)) === "true"
  );
}

async function run() {
  const proofHex = hex(`${TARGET}/proof`);
  const publicInputsHex = hex(`${TARGET}/public_inputs`);
  const ok = await verify(proofHex, publicInputsHex);
  console.log("on-chain verify_proof =>", ok);
  if (!ok) throw new Error("existing proof did not verify true on-chain");

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(
    OUT,
    JSON.stringify(
      {
        _comment:
          "Real Barretenberg UltraHonk payroll proof. Re-verified live on-chain by /api/verify-onchain.",
        verifier: ID,
        entrypoint: "verify_proof",
        proofHex,
        publicInputsHex,
      },
      null,
      2,
    ) + "\n",
  );
  console.log("Wrote fixture ->", OUT);
}
run()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
