import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Orbitron } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-ui",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

const orbitron = Orbitron({
  variable: "--font-display",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Zebra — Confidential Stablecoin Payroll",
  description:
    "Zebra enables companies to execute private stablecoin payrolls on Stellar while providing compliance view keys to auditors.",
  icons: {
    icon: "/icon.svg",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "Zebra — Confidential Stablecoin Payroll",
    description:
      "Zebra enables companies to execute private stablecoin payrolls on Stellar while providing compliance view keys to auditors.",
    url: "https://zebra.edycu.dev",
    siteName: "Zebra",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Zebra — Confidential Stablecoin Payroll",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Zebra — Confidential Stablecoin Payroll",
    description:
      "Zebra enables companies to execute private stablecoin payrolls on Stellar while providing compliance view keys to auditors.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} ${orbitron.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
