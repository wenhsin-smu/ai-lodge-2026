import type { Metadata } from "next";
import { Baloo_2, Nunito } from "next/font/google";
import "./globals.css";

// Rounded, friendly UI font, plus a bubbly display font for headings only.
const ui = Nunito({ subsets: ["latin"], variable: "--font-ui", weight: ["400", "600", "700", "800"] });
const display = Baloo_2({ subsets: ["latin"], variable: "--font-display", weight: ["600", "700", "800"] });

export const metadata: Metadata = {
  title: "Study Booth",
  description: "Study apart, together.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${ui.variable} ${display.variable}`}>
      <body>{children}</body>
    </html>
  );
}
