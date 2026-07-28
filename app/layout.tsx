import type { Metadata } from "next";
import { Archivo, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import "./globals.css";

/**
 * v3 typography. The v2 system was Barlow Condensed 700 italic caps, which is narrow,
 * slanted and shouted. Every axis is inverted here: a high-contrast roman serif at
 * sentence case for display, a wide neutral grotesque for the interface, a mono with
 * tabular figures for anything countable. Nothing is set in capitals.
 */
const display = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});
const body = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CITED — answer engine visibility",
  description: "Measure why answer engines skip a page, write the fixes, prove the gain by re-testing.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
