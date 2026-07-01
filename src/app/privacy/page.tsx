import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — Zebra",
};

export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-300 px-6 py-16">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/"
          className="font-mono text-xs tracking-widest text-cyan-400 hover:text-cyan-300 uppercase"
        >
          ← Zebra
        </Link>
        <h1 className="text-4xl md:text-5xl font-extrabold text-white mt-6 mb-2">
          Privacy Policy
        </h1>
        <p className="text-slate-500 text-sm mb-10">
          Last updated: July 1, 2026
        </p>

        <div className="space-y-8 leading-relaxed text-slate-400">
          <p>
            Zebra is a demonstration application built for the DoraHacks
            &ldquo;Stellar Hacks: Real-World ZK&rdquo; hackathon and runs on the
            Stellar <strong className="text-slate-200">test network</strong>.
            This policy describes the limited data the app touches.
          </p>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">
              No accounts, no personal data
            </h2>
            <p>
              Zebra has no sign-up and does not collect names, emails, or other
              personally identifying information. It sets no advertising or
              cross-site tracking cookies.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">
              Wallet &amp; on-chain data
            </h2>
            <p>
              If you connect Freighter, the app reads your public Stellar
              address to construct testnet transactions that you explicitly
              approve in your wallet. Public keys and transactions recorded on
              the Stellar ledger are inherently public and outside our control.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">
              Payroll data &amp; sandbox mode
            </h2>
            <p>
              The demo payroll records are sample data. In the default sandbox
              mode all cryptographic operations are simulated locally in your
              browser; encrypted view-keys and audit rows written to the demo
              backend contain only ciphertext and public hashes — never your
              keys.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">
              Hosting &amp; logs
            </h2>
            <p>
              The site is hosted on Vercel, which may process standard request
              metadata (such as IP address and browser user-agent) in server
              logs for security and reliability. We do not sell or share your
              data.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">Contact</h2>
            <p>
              Questions? Reach the maintainer via the{" "}
              <a
                href="https://github.com/edycutjong/zebra"
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-400 hover:text-cyan-300"
              >
                project repository
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
