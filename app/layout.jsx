import "./globals.css";
import { GeistSans } from "geist/font/sans";
import { cn } from "@/lib/utils";

const geist = GeistSans;

export const metadata = {
  title: "InVitro Capital — Shareholder Dashboard",
  description:
    "Consolidated Financial Performance Dashboard for InVitro Capital Holdings",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body>{children}</body>
    </html>
  );
}
