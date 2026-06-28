import { NextResponse } from "next/server";
import { rpc } from "@stellar/stellar-sdk";

// Live status endpoint. Reads the real Soroban testnet RPC and the deployed
// Zebra payroll contract — no hardcoded metrics. The on-chain ZK verification
// itself is reproduced by `npm run prove:demo` (real Noir/UltraHonk proof
// submitted to verify_proof on the contract below).

export const dynamic = "force-dynamic";

const RPC_URL =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ||
  "https://soroban-testnet.stellar.org";
const CONTRACT_ID =
  process.env.NEXT_PUBLIC_TREASURY_CONTRACT_ID ||
  "CCLTVNPYS5H2AY4OTYIYDU57XYO4S5OZQE435ZZX2TFUVYDAIS6B53N5";

export async function GET() {
  try {
    const server = new rpc.Server(RPC_URL, {
      allowHttp: RPC_URL.startsWith("http://"),
    });
    const [health, latestLedger] = await Promise.all([
      server.getHealth(),
      server.getLatestLedger(),
    ]);

    return NextResponse.json({
      status: health.status === "healthy" ? "connected" : health.status,
      network: process.env.NEXT_PUBLIC_STELLAR_NETWORK || "testnet",
      rpc_url: RPC_URL,
      contract: CONTRACT_ID,
      latest_ledger: latestLedger.sequence,
      protocol_version: latestLedger.protocolVersion,
      verify_entrypoint: "verify_proof",
      note: "Real Noir/UltraHonk proof verification is reproduced via `npm run prove:demo`.",
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: "rpc_unreachable",
        network: process.env.NEXT_PUBLIC_STELLAR_NETWORK || "testnet",
        contract: CONTRACT_ID,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 503 },
    );
  }
}
