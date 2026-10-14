import type { Metadata } from "next";
import "98.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Study Booth",
  description: "Study apart, together.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
