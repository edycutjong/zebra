import { NextResponse } from "next/server";
import {
  rpc,
  TransactionBuilder,
  Networks,
  Contract,
  nativeToScVal,
  Account,
  scValToNative,
} from "@stellar/stellar-sdk";
import fixture from "./proof.json";

// Re-verifies a REAL Barretenberg UltraHonk payroll proof against the deployed
// Soroban contract via read-only simulation (no wallet, no fee). Real proof =>
// true; byte-tampered public inputs => false. Makes the on-chain ZK
// verification witnessable in the browser, not just the CLI.

export const dynamic = "force-dynamic";

const RPC_URL =
  process.env.NEXT_PUBLIC_STELLAR_RPC_URL ||
  "https://soroban-testnet.stellar.org";
const VERIFIER = fixture.verifier;
const SOURCE = "GAZV4ZZRKEWHOHWSVKLX7VZVDGJ6GAVSPHMFDBYMS6WQ74DBYP3FOMMX";

async function verifyOnChain(
  proofHex: string,
  publicInputsHex: string,
): Promise<boolean> {
  const server = new rpc.Server(RPC_URL, {
    allowHttp: RPC_URL.startsWith("http://"),
  });
  const contract = new Contract(VERIFIER);
  const call = contract.call(
    "verify_proof",
    nativeToScVal(Buffer.from(proofHex, "hex")),
    nativeToScVal(Buffer.from(publicInputsHex, "hex")),
  );
  const tx = new TransactionBuilder(new Account(SOURCE, "0"), {
    fee: "100",
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(call)
    .setTimeout(30)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim) || !sim.result) return false;
  return String(scValToNative(sim.result.retval)) === "true";
}

export async function GET() {
  const pi: string = fixture.publicInputsHex;
  // Flip the first nibble of the public inputs -> no longer matches the proof.
  const tampered = (pi[0] === "f" ? "e" : "f") + pi.slice(1);

  try {
    const [validProof, tamperedProof] = await Promise.all([
      verifyOnChain(fixture.proofHex, pi),
      verifyOnChain(fixture.proofHex, tampered),
    ]);
    return NextResponse.json({
      network: "testnet",
      verifier: VERIFIER,
      entrypoint: "verify_proof",
      valid_proof: validProof,
      tampered_proof: tamperedProof,
      explorer: `https://stellar.expert/explorer/testnet/contract/${VERIFIER}`,
      note: "Real Barretenberg UltraHonk payroll proof, re-verified live on the deployed Soroban contract by read-only simulation. Tampered public inputs are rejected.",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
