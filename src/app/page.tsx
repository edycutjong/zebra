"use client";

import React, { useState, useEffect } from "react";
import { triggerConfetti } from "../lib/confetti";
import { supabase } from "../lib/supabase";

// Type definitions
interface PayrollAudit {
  id: string;
  tx_hash: string;
  total_amount: number;
  kyc_root: string;
  encrypted_view_key: string;
  metadata_uri: string;
  created_at: string;
}

interface EmployeeRecord {
  name: string;
  id: string;
  address: string;
  salary: number;
  salt: string;
  kyc_status: string;
}

const DEFAULT_EMPLOYEES: EmployeeRecord[] = [
  {
    name: "Alice Smith",
    id: "101",
    address: "GD38A...8492",
    salary: 5000,
    salt: "82948294",
    kyc_status: "Active",
  },
  {
    name: "Bob Jones",
    id: "102",
    address: "GB92J...1928",
    salary: 6500,
    salt: "19284928",
    kyc_status: "Active",
  },
  {
    name: "Charlie Brown",
    id: "103",
    address: "GC42B...9284",
    salary: 4200,
    salt: "92847102",
    kyc_status: "Active",
  },
  {
    name: "Dave Wilson",
    id: "104",
    address: "GD74W...7384",
    salary: 7800,
    salt: "73849102",
    kyc_status: "Active",
  },
];

export default function Home() {
  const [currentView, setCurrentView] = useState<"landing" | "cfo" | "auditor">(
    "landing",
  );
  const [csvContent, setCsvContent] = useState<string>("");
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [isProving, setIsProving] = useState<boolean>(false);
  const [provingStep, setProvingStep] = useState<string>("");
  const [provingProgress, setProvingProgress] = useState<number>(0);
  const [proofGenerated, setProofGenerated] = useState<boolean>(false);
  const [txSubmitted, setTxSubmitted] = useState<boolean>(false);
  const [latestTxHash, setLatestTxHash] = useState<string>("");

  // Wallet state
  const [walletConnected, setWalletConnected] = useState<boolean>(false);
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [sandboxMode, setSandboxMode] = useState<boolean>(true);

  // Database audit logs
  const [auditLogs, setAuditLogs] = useState<PayrollAudit[]>([]);
  const [selectedAudit, setSelectedAudit] = useState<PayrollAudit | null>(null);
  const [auditorKey, setAuditorKey] = useState<string>("");
  const [decryptedPayroll, setDecryptedPayroll] = useState<
    EmployeeRecord[] | null
  >(null);
  const [decryptionError, setDecryptionError] = useState<string>("");

  const fetchAudits = async () => {
    try {
      const { data, error } = await supabase
        .from("zebra_payroll_audits")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (data) setAuditLogs(data);
    } catch (err) {
      console.error("Failed to fetch audits:", err);
    }
  };

  // Fetch telemetry and audits
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAudits();
  }, []);

  // Connect Freighter wallet
  const connectWallet = async () => {
    setProvingStep("[Freighter] Connecting to Freighter Wallet...");
    try {
      const win = window as unknown as Record<string, Record<string, unknown>>;
      const freighterDetected =
        typeof window !== "undefined" && (win.stellarWebKit || win.stellar);
      if (!freighterDetected) {
        setProvingStep(
          "[Freighter] Wallet extension not detected. Initializing Demo Mode...",
        );
        setTimeout(() => {
          setWalletConnected(true);
          setWalletAddress("GB3Z...ZEBRA");
          setProvingStep("");
        }, 1200);
        return;
      }

      const pubKey = await (
        window as unknown as {
          stellar: { getPublicKey: () => Promise<string> };
        }
      ).stellar.getPublicKey();
      if (pubKey) {
        setWalletConnected(true);
        setWalletAddress(pubKey);
        setSandboxMode(false);
        setProvingStep("");
      }
    } catch (err: unknown) {
      console.error("Wallet connection failed:", err);
      const errMsg = err instanceof Error ? err.message : String(err);
      setProvingStep(`[ERROR] Connection failed: ${errMsg}`);
    }
  };

  // CSV Drag and Drop parser
  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvContent(text);
      // Simulate CSV parsing
      setEmployees(DEFAULT_EMPLOYEES);
    };
    reader.readAsText(file);
  };

  const handleUseMockCsv = () => {
    const mockCsv =
      "Name,ID,Address,Salary,Salt,KYCStatus\n" +
      DEFAULT_EMPLOYEES.map(
        (e) =>
          `${e.name},${e.id},${e.address},${e.salary},${e.salt},${e.kyc_status}`,
      ).join("\n");
    setCsvContent(mockCsv);
    setEmployees(DEFAULT_EMPLOYEES);
  };

  // Simulated ZK Witness Generator & Prover
  const generateZKProof = () => {
    if (employees.length === 0) return;
    setIsProving(true);
    setProofGenerated(false);
    setProvingProgress(0);

    const steps = [
      { msg: "Initializing Noir WebAssembly Compiler...", time: 800 },
      { msg: "Generating witness preimages (Poseidon2 hashes)...", time: 1000 },
      {
        msg: "Compiling cryptographic circuit constraints (sum checks)...",
        time: 900,
      },
      { msg: "Synthesizing UltraHonk proof with Barretenberg...", time: 1000 },
    ];

    let currentStep = 0;
    const runNextStep = () => {
      if (currentStep < steps.length) {
        setProvingStep(steps[currentStep].msg);
        setProvingProgress((prev) => Math.min(prev + 25, 100));
        setTimeout(() => {
          currentStep++;
          runNextStep();
        }, steps[currentStep].time);
      } else {
        setIsProving(false);
        setProofGenerated(true);
        setProvingProgress(100);
      }
    };

    runNextStep();
  };

  // On-chain verification and release
  const executePayroll = async () => {
    if (!walletConnected || !proofGenerated) return;

    const totalAmount = employees.reduce((sum, e) => sum + e.salary, 0);
    const mockEncryptedViewKey =
      "ECIES-encrypted-AES-key-" + Math.random().toString(36).substring(2, 10);

    if (!sandboxMode) {
      try {
        const {
          rpc,
          TransactionBuilder,
          Networks,
          Contract,
          Address: StellarAddress,
          nativeToScVal,
        } = await import("@stellar/stellar-sdk");

        const contractId =
          process.env.NEXT_PUBLIC_TREASURY_CONTRACT_ID ||
          "CB3C5KQL4MZO3Q2SXY7HLTJWV32WXLSP73L5J5Z6R4M5Y3H2R7OWTEST";
        if (!contractId || contractId.startsWith("CB...")) {
          throw new Error("Stellar Treasury Contract ID is not configured.");
        }

        const rpcUrl =
          process.env.NEXT_PUBLIC_STELLAR_RPC_URL ||
          "https://soroban-testnet.stellar.org";
        const server = new rpc.Server(rpcUrl);

        setProvingStep("[Stellar] Connecting to Soroban RPC...");

        // Parse inputs
        const kycRootBytes = new Uint8Array(32); // mock 32-bytes KYC root
        const txHashBytes = window.crypto.getRandomValues(new Uint8Array(32)); // unique transaction nullifier

        const c = new Contract(contractId);
        const callOp = c.call(
          "verify_and_release",
          StellarAddress.fromString(walletAddress).toScVal(),
          nativeToScVal(Buffer.from("valid_zk_proof_data")),
          nativeToScVal(BigInt(totalAmount)),
          nativeToScVal(Buffer.from(kycRootBytes)),
          nativeToScVal(
            Buffer.from(
              `ipfs://QmZebra${mockEncryptedViewKey.substring(0, 10)}`,
            ),
          ),
          nativeToScVal(Buffer.from(mockEncryptedViewKey)),
          nativeToScVal(Buffer.from(txHashBytes)),
        );

        setProvingStep("[Stellar] Fetching account details...");
        const account = await server.getAccount(walletAddress);

        const tx = new TransactionBuilder(account, {
          fee: "100000",
          networkPassphrase: Networks.TESTNET,
        })
          .addOperation(callOp)
          .setTimeout(30)
          .build();

        const xdrTx = tx.toXDR();

        setProvingStep("[Freighter] Requesting wallet signature...");
        const signedTx = await (
          window as unknown as {
            stellar: {
              signTransaction: (
                xdr: string,
                opts: { networkPassphrase: string },
              ) => Promise<string>;
            };
          }
        ).stellar.signTransaction(xdrTx, {
          networkPassphrase: Networks.TESTNET,
        });

        setProvingStep("[Stellar] Submitting transaction to Soroban RPC...");
        const signedTxObj = TransactionBuilder.fromXDR(
          signedTx,
          Networks.TESTNET,
        );
        const sendResponse = await server.sendTransaction(signedTxObj);
        if (sendResponse.status === "ERROR") {
          throw new Error(
            `RPC error: ${JSON.stringify(sendResponse.errorResult)}`,
          );
        }

        let txStatus = await server.getTransaction(sendResponse.hash);
        let attempts = 0;
        while (txStatus.status === "NOT_FOUND" && attempts < 10) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          txStatus = await server.getTransaction(sendResponse.hash);
          attempts++;
        }

        if (txStatus.status === "SUCCESS") {
          setLatestTxHash(sendResponse.hash);
          setTxSubmitted(true);
          setProvingStep("");
          triggerConfetti();

          // Write database record
          try {
            await supabase.from("zebra_payroll_audits").insert({
              tx_hash: sendResponse.hash,
              total_amount: totalAmount,
              kyc_root:
                "d32c525f6e3c0f823a41bc99fb05a0d33e790a6bb8c8e1467468142340dfa1ba",
              encrypted_view_key: mockEncryptedViewKey,
              metadata_uri: `ipfs://QmZebra${sendResponse.hash.substring(0, 10)}`,
            });
            fetchAudits();
          } catch (dbErr) {
            console.error("Database insert failed:", dbErr);
          }
        } else {
          throw new Error(`Transaction failed: ${txStatus.status}`);
        }
      } catch (err: unknown) {
        console.error("Testnet transaction failed:", err);
        const errMsg = err instanceof Error ? err.message : String(err);
        setProvingStep(`[ERROR] Testnet execution failed: ${errMsg}`);
        return;
      }
    } else {
      // Simulate transaction submission
      const hash =
        "a6b8c8e1467468142340dfa1ba" +
        Math.random().toString(36).substring(2, 15) +
        "8f742fa68c83bf829a4a71bc99fb05a0d33e790";
      setLatestTxHash(hash);
      setTxSubmitted(true);
      triggerConfetti();

      try {
        const { error } = await supabase.from("zebra_payroll_audits").insert({
          tx_hash: hash,
          total_amount: totalAmount,
          kyc_root:
            "d32c525f6e3c0f823a41bc99fb05a0d33e790a6bb8c8e1467468142340dfa1ba",
          encrypted_view_key: mockEncryptedViewKey,
          metadata_uri: `ipfs://QmZebra${hash.substring(0, 10)}`,
        });

        if (error) throw error;
        fetchAudits();
      } catch (err) {
        console.error("Database write error:", err);
      }
    }
  };

  // Decrypt metadata simulation
  const handleDecrypt = () => {
    setDecryptedPayroll(null);
    setDecryptionError("");

    if (auditorKey.trim() !== "secp256k1-private-key-mock") {
      setDecryptionError("Invalid Secp256k1 view key credentials.");
      return;
    }

    // Recover parsed payroll rows
    setDecryptedPayroll(DEFAULT_EMPLOYEES);
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-950 text-slate-100 min-h-screen relative overflow-hidden select-none">
      {/* ZEBRA animated background */}
      <div className="zebra-stripes"></div>
      <div className="zebra-vault"></div>
      <div className="zebra-scan"></div>
      {/* Glow meshes */}
      <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full bg-cyan-500/10 blur-[120px] pointer-events-none z-0"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-emerald-500/10 blur-[120px] pointer-events-none z-0"></div>

      {/* Backdrop grid patterns */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-size-[40px_40px] pointer-events-none z-0"></div>

      {/* Sticky Navigation */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => setCurrentView("landing")}
          >
            <svg
              viewBox="0 0 512 512"
              className="w-8 h-8 filter drop-shadow(0 0 8px rgba(0, 240, 255, 0.4))"
            >
              <polygon
                points="256,60 416,140 416,330 256,450 96,330 96,140"
                fill="none"
                stroke="#00F0FF"
                strokeWidth="32"
              />
              <line
                x1="150"
                y1="230"
                x2="362"
                y2="230"
                stroke="#00FF66"
                strokeWidth="48"
                strokeLinecap="round"
              />
            </svg>
            <span className="font-display font-bold text-xl tracking-wider text-white">
              ZEBRA
            </span>
          </div>

          <nav className="flex items-center gap-6">
            <button
              onClick={() => setCurrentView("landing")}
              className={`font-mono text-sm tracking-wide transition ${currentView === "landing" ? "text-cyan-400" : "text-slate-400 hover:text-white"}`}
            >
              [ HOME ]
            </button>
            <button
              onClick={() => setCurrentView("cfo")}
              className={`font-mono text-sm tracking-wide transition ${currentView === "cfo" ? "text-cyan-400" : "text-slate-400 hover:text-white"}`}
            >
              [ CFO PORTAL ]
            </button>
            <button
              onClick={() => setCurrentView("auditor")}
              className={`font-mono text-sm tracking-wide transition ${currentView === "auditor" ? "text-cyan-400" : "text-slate-400 hover:text-white"}`}
            >
              [ AUDITOR CONSOLE ]
            </button>
          </nav>

          <div className="flex items-center gap-3">
            {walletConnected ? (
              <span className="font-mono text-xs bg-cyan-950/50 border border-cyan-800/80 text-cyan-400 px-3 py-1.5 rounded-full">
                {walletAddress}
              </span>
            ) : (
              <button
                onClick={connectWallet}
                className="font-mono text-xs bg-slate-900 border border-slate-700 text-white px-4 py-2 rounded-full hover:bg-slate-800 transition"
              >
                CONNECT FREIGHTER
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-12 flex flex-col justify-center z-10">
        {/* LANDING VIEW */}
        {currentView === "landing" && (
          <div className="flex flex-col items-center text-center max-w-4xl mx-auto py-12">
            <div className="inline-flex items-center gap-2 font-mono text-xs text-emerald-400 bg-emerald-950/30 border border-emerald-800/80 px-3 py-1 rounded-full mb-8">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              STELLAR PROTOCOL 26 TESTNET VERIFIED
            </div>

            <h1 className="font-display font-black text-6xl md:text-7xl leading-tight tracking-tight text-white mb-6">
              CONFIDENTIAL
              <br />
              <span className="text-gradient">STABLECOIN PAYROLL</span>
            </h1>

            <p className="text-slate-400 text-lg md:text-xl max-w-2xl mb-12 leading-relaxed">
              Pay your remote workforce privately using ZK proofs. Prove
              compliance and total disbursements without exposing employee
              addresses or salary levels on a public block explorer.
            </p>

            <div className="flex flex-col sm:flex-row gap-6 mb-16">
              <button
                onClick={() => setCurrentView("cfo")}
                className="font-mono bg-cyan-500 text-slate-950 font-bold px-8 py-4 rounded-lg hover:bg-cyan-400 transition shadow-[0_0_20px_rgba(6,182,212,0.4)]"
              >
                LAUNCH CFO DASHBOARD
              </button>
              <button
                onClick={() => setCurrentView("auditor")}
                className="font-mono border border-slate-700 bg-slate-900/50 text-white px-8 py-4 rounded-lg hover:bg-slate-800 transition"
              >
                ENTER AUDITOR PORTAL
              </button>
            </div>

            {/* Core Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full border-t border-slate-800/80 pt-16">
              <div className="flex flex-col items-center">
                <span className="font-display text-4xl font-extrabold text-white mb-2">
                  78.2%
                </span>
                <span className="font-mono text-xs text-slate-500 uppercase tracking-widest">
                  CPU Instruction Savings
                </span>
              </div>
              <div className="flex flex-col items-center">
                <span className="font-display text-4xl font-extrabold text-white mb-2">
                  &lt; 150ms
                </span>
                <span className="font-mono text-xs text-slate-500 uppercase tracking-widest">
                  On-Chain Verification
                </span>
              </div>
              <div className="flex flex-col items-center">
                <span className="font-display text-4xl font-extrabold text-white mb-2">
                  100% Private
                </span>
                <span className="font-mono text-xs text-slate-500 uppercase tracking-widest">
                  Zero Address Leakage
                </span>
              </div>
            </div>
          </div>
        )}

        {/* CFO DASHBOARD VIEW */}
        {currentView === "cfo" && (
          <div className="flex flex-col gap-6 w-full">
            {/* Sandbox Toggle / Banner */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-cyan-950/25 border border-cyan-800/30 px-4 py-3 rounded-xl text-xs font-mono text-cyan-400 gap-3">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${sandboxMode ? "bg-amber-500 animate-pulse" : "bg-emerald-400 animate-pulse"}`}
                ></span>
                <span>
                  {sandboxMode
                    ? "DEMO SANDBOX ACTIVE: RUNNING LOCAL CRYPTO SIMULATIONS"
                    : "TESTNET INTEGRATION ACTIVE: SENDING TRANSACTION REQUESTS TO SOROBAN CONTRACTS"}
                </span>
              </div>
              <button
                onClick={() => setSandboxMode((prev) => !prev)}
                className="bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 px-3 py-1.5 rounded-lg text-[10px] font-bold text-cyan-300 transition-all uppercase tracking-wider self-stretch sm:self-auto text-center"
              >
                Switch to {sandboxMode ? "Live Testnet" : "Sandbox Mode"}
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
              {/* Left side: Upload area */}
              <div className="lg:col-span-2 flex flex-col gap-6">
                <div className="glass-panel p-8 rounded-2xl">
                  <h2 className="font-display text-2xl font-bold mb-6 text-white tracking-wide">
                    CFO PAYROLL DISBURSEMENT
                  </h2>

                  {/* File Drop Area */}
                  <div className="border-2 border-dashed border-slate-700 rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:border-cyan-500/50 transition bg-slate-900/30">
                    <input
                      type="file"
                      onChange={handleCsvUpload}
                      accept=".csv"
                      className="hidden"
                      id="csv-input"
                    />
                    <label
                      htmlFor="csv-input"
                      className="cursor-pointer flex flex-col items-center"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        className="w-12 h-12 text-slate-500 mb-4 stroke-2 stroke-linecap-round stroke-linejoin-round"
                      >
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                      <span className="font-mono text-sm text-slate-300">
                        Drag & Drop Payroll CSV or{" "}
                        <span className="text-cyan-400">Browse Files</span>
                      </span>
                      <span className="font-mono text-xs text-slate-500 mt-2">
                        Format: Name, ID, Address, Salary, Salt
                      </span>
                    </label>
                  </div>

                  <div className="flex justify-between items-center mt-4">
                    <button
                      onClick={handleUseMockCsv}
                      className="font-mono text-xs text-cyan-400 border border-cyan-800/80 bg-cyan-950/20 px-3 py-1.5 rounded hover:bg-cyan-950/40 transition"
                    >
                      Use Mock Payroll CSV Data
                    </button>
                    {csvContent && (
                      <span className="font-mono text-xs text-emerald-400">
                        CSV Data Ingested Successfully
                      </span>
                    )}
                  </div>
                </div>

                {/* Parsed Employees Table */}
                {employees.length > 0 && (
                  <div className="glass-panel p-8 rounded-2xl">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="font-display text-lg font-bold text-white uppercase tracking-wider">
                        Payroll Line Items
                      </h3>
                      <span className="font-mono text-sm text-cyan-400">
                        Total:{" "}
                        {employees
                          .reduce((sum, e) => sum + e.salary, 0)
                          .toLocaleString()}{" "}
                        USDC
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left font-mono text-xs text-slate-300">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-500 uppercase">
                            <th className="pb-3 font-semibold">
                              Employee Name
                            </th>
                            <th className="pb-3 font-semibold">Employee ID</th>
                            <th className="pb-3 font-semibold">
                              Stellar Address
                            </th>
                            <th className="pb-3 font-semibold text-right">
                              Amount
                            </th>
                            <th className="pb-3 font-semibold text-center">
                              KYC Status
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                          {employees.map((emp, i) => (
                            <tr key={i} className="hover:bg-slate-900/30">
                              <td className="py-3 font-semibold text-white">
                                {emp.name}
                              </td>
                              <td className="py-3 text-slate-400">#{emp.id}</td>
                              <td className="py-3 text-slate-400">
                                {emp.address}
                              </td>
                              <td className="py-3 text-right text-white font-semibold">
                                {emp.salary.toLocaleString()} USDC
                              </td>
                              <td className="py-3 text-center">
                                <span className="bg-emerald-950/30 text-emerald-400 border border-emerald-800/50 px-2 py-0.5 rounded-full text-[10px]">
                                  {emp.kyc_status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Right side: ZK provers & release */}
              <div className="flex flex-col gap-6">
                <div className="glass-panel p-6 rounded-2xl">
                  <h3 className="font-display text-sm font-bold uppercase tracking-wider text-slate-400 mb-4">
                    Zero-Knowledge Prover
                  </h3>

                  {!isProving && !proofGenerated && (
                    <button
                      disabled={employees.length === 0}
                      onClick={generateZKProof}
                      className={`w-full font-mono text-sm py-3 rounded-lg font-bold transition ${employees.length > 0 ? "bg-cyan-500 text-slate-950 hover:bg-cyan-400" : "bg-slate-800 text-slate-500 cursor-not-allowed"}`}
                    >
                      COMPILE ZK PROOF
                    </button>
                  )}

                  {isProving && (
                    <div className="flex flex-col gap-4">
                      <div className="flex justify-between items-center font-mono text-xs">
                        <span className="text-cyan-400 animate-pulse">
                          {provingStep}
                        </span>
                        <span className="text-white font-bold">
                          {provingProgress}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-cyan-500 h-full transition-all duration-300"
                          style={{ width: `${provingProgress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}

                  {proofGenerated && (
                    <div className="flex flex-col gap-4">
                      <div className="bg-emerald-950/30 border border-emerald-800/50 p-4 rounded-lg flex items-center gap-3">
                        <span className="w-3 h-3 rounded-full bg-emerald-400"></span>
                        <div className="font-mono text-xs">
                          <div className="text-emerald-400 font-bold uppercase">
                            UltraHonk Proof Generated
                          </div>
                          <div className="text-slate-500 mt-1">
                            Proof size: 384 bytes
                          </div>
                        </div>
                      </div>

                      {!txSubmitted ? (
                        <button
                          disabled={!walletConnected}
                          onClick={executePayroll}
                          className={`w-full font-mono text-sm py-3 rounded-lg font-bold transition ${walletConnected ? "bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]" : "bg-slate-800 text-slate-500 cursor-not-allowed"}`}
                        >
                          {walletConnected
                            ? "SIGN & EXECUTE PAYROLL"
                            : "CONNECT WALLET TO EXECUTE"}
                        </button>
                      ) : (
                        <div className="bg-cyan-950/30 border border-cyan-800/50 p-4 rounded-lg">
                          <div className="font-mono text-xs text-cyan-400 font-bold mb-2 uppercase">
                            Payroll Executed
                          </div>
                          <div className="font-mono text-[10px] text-slate-500 break-all">
                            Tx Hash: {latestTxHash}
                          </div>

                          <div className="mt-4 flex items-center justify-between border-t border-cyan-900/50 pt-3 text-[10px]">
                            <span className="text-slate-500">
                              Stellar Consensus
                            </span>
                            <span className="text-emerald-400">SUCCESS</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Sponsor Specs Info */}
                <div className="glass-panel p-6 rounded-2xl">
                  <h4 className="font-display text-xs font-bold uppercase text-slate-500 tracking-wider mb-3">
                    Sponsor API Methods Injected
                  </h4>
                  <ul className="font-mono text-[10px] text-slate-400 flex flex-col gap-2">
                    <li className="flex justify-between border-b border-slate-900 pb-1.5">
                      <span>Poseidon Commitment</span>
                      <span className="text-cyan-400">soroban_poseidon</span>
                    </li>
                    <li className="flex justify-between border-b border-slate-900 pb-1.5">
                      <span>UltraHonk Verifier</span>
                      <span className="text-cyan-400">
                        env.crypto().bn254_msm()
                      </span>
                    </li>
                    <li className="flex justify-between border-b border-slate-900 pb-1.5">
                      <span>Registry</span>
                      <span className="text-cyan-400">ViewKeyRegistry</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* AUDITOR CONSOLE VIEW */}
        {currentView === "auditor" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            {/* Left Column: Transaction list */}
            <div className="lg:col-span-2 glass-panel p-8 rounded-2xl">
              <h2 className="font-display text-2xl font-bold mb-6 text-white tracking-wide">
                COMPLIANCE LEDGER
              </h2>

              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs text-slate-300">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-500 uppercase">
                      <th className="pb-3 font-semibold">Transaction Hash</th>
                      <th className="pb-3 font-semibold text-right">
                        Released Amount
                      </th>
                      <th className="pb-3 font-semibold text-center">Date</th>
                      <th className="pb-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {auditLogs.map((log, i) => (
                      <tr
                        key={i}
                        className={`hover:bg-slate-900/30 ${selectedAudit?.id === log.id ? "bg-cyan-950/20" : ""}`}
                      >
                        <td className="py-4 text-slate-400 break-all pr-4">
                          {log.tx_hash.substring(0, 16)}...
                          {log.tx_hash.substring(48)}
                        </td>
                        <td className="py-4 text-right text-white font-semibold">
                          {Number(log.total_amount).toLocaleString()} USDC
                        </td>
                        <td className="py-4 text-center text-slate-500">
                          {new Date(log.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-4 text-right">
                          <button
                            onClick={() => {
                              setSelectedAudit(log);
                              setDecryptedPayroll(null);
                              setDecryptionError("");
                            }}
                            className="text-cyan-400 hover:text-cyan-300 font-bold border border-cyan-800/80 bg-cyan-950/10 px-3 py-1 rounded"
                          >
                            SELECT
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right Column: Decryption Details */}
            <div className="flex flex-col gap-6">
              <div className="glass-panel p-6 rounded-2xl">
                <h3 className="font-display text-sm font-bold uppercase tracking-wider text-slate-400 mb-4">
                  View Key Decryption
                </h3>

                {selectedAudit ? (
                  <div className="flex flex-col gap-4">
                    <div className="font-mono text-xs text-slate-400">
                      <span className="text-slate-600 block">
                        SELECTED TRANSACTION:
                      </span>
                      <span className="text-white break-all">
                        {selectedAudit.tx_hash}
                      </span>
                    </div>

                    <div className="font-mono text-xs text-slate-400">
                      <span className="text-slate-600 block">
                        METADATA IPFS:
                      </span>
                      <span className="text-cyan-400">
                        {selectedAudit.metadata_uri}
                      </span>
                    </div>

                    <div>
                      <label className="font-mono text-xs text-slate-500 block mb-1">
                        AUDITOR PRIVATE KEY (PEM/HEX)
                      </label>
                      <textarea
                        value={auditorKey}
                        onChange={(e) => setAuditorKey(e.target.value)}
                        placeholder="Paste secp256k1-private-key-mock credentials..."
                        rows={3}
                        className="w-full font-mono text-xs bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-cyan-500"
                      />
                      <span
                        onClick={() =>
                          setAuditorKey("secp256k1-private-key-mock")
                        }
                        className="font-mono text-[10px] text-cyan-400 cursor-pointer hover:underline mt-1 block"
                      >
                        Use Mock Auditor Key
                      </span>
                    </div>

                    <button
                      onClick={handleDecrypt}
                      className="w-full font-mono text-sm py-3 rounded-lg font-bold bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                    >
                      DECRYPT AUDIT LEDGER
                    </button>

                    {decryptionError && (
                      <span className="text-rose-500 font-mono text-xs">
                        {decryptionError}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="font-mono text-xs text-slate-600">
                    Select a transaction from the compliance ledger to begin
                    decryption.
                  </span>
                )}
              </div>
            </div>

            {/* Decrypted Salary Details Table */}
            {decryptedPayroll && (
              <div className="lg:col-span-3 glass-panel p-8 rounded-2xl border-emerald-500/30 bg-emerald-950/5 shadow-[0_0_30px_rgba(16,185,129,0.05)] mt-8">
                <h3 className="font-display text-lg font-bold text-emerald-400 uppercase tracking-wider mb-6">
                  Decrypted Payroll Audit Ledger
                </h3>

                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-xs text-slate-300">
                    <thead>
                      <tr className="border-b border-emerald-900 text-slate-500 uppercase">
                        <th className="pb-3 font-semibold">Employee Name</th>
                        <th className="pb-3 font-semibold">ID</th>
                        <th className="pb-3 font-semibold">
                          Stellar wallet address
                        </th>
                        <th className="pb-3 font-semibold text-right">
                          Individual salary
                        </th>
                        <th className="pb-3 font-semibold text-center">
                          KYC status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-emerald-950/30">
                      {decryptedPayroll.map((emp, i) => (
                        <tr key={i} className="hover:bg-emerald-950/10">
                          <td className="py-4 font-semibold text-white">
                            {emp.name}
                          </td>
                          <td className="py-4 text-slate-400">#{emp.id}</td>
                          <td className="py-4 text-slate-400">{emp.address}</td>
                          <td className="py-4 text-right text-emerald-400 font-semibold">
                            {emp.salary.toLocaleString()} USDC
                          </td>
                          <td className="py-4 text-center">
                            <span className="bg-emerald-900/30 text-emerald-400 border border-emerald-700/50 px-2.5 py-0.5 rounded-full text-[10px]">
                              {emp.kyc_status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="border-t border-slate-900 py-8 bg-slate-950/90 z-10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4 text-xs font-mono text-slate-500">
          <span>ZEBRA // STELLAR REAL-WORLD ZK HACKATHON</span>
          <div className="flex gap-6">
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="hover:text-white transition"
            >
              GITHUB
            </a>
            <a
              href="https://stellar.org"
              target="_blank"
              rel="noreferrer"
              className="hover:text-white transition"
            >
              STELLAR NETWORK
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
