import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "../components/Navbar";
import WalletAdapterProvider from "../components/WalletAdapterProvider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata = {
  title: "ANFT — Authentic Art NFT Marketplace",
  description: "Create, mint, and trade authentic NFTs with verified provenance on Solana",
  keywords: "NFT, Authentic Art, Solana, Blockchain, Digital Art, Marketplace, DID, Provenance",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${inter.variable}`}>
        <WalletAdapterProvider>
          <div className="layout-container">
            <Navbar />
            <main className="main-content">
              {children}
            </main>
          </div>
        </WalletAdapterProvider>
      </body>
    </html>
  );
}
