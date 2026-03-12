import "./globals.css";

export const metadata = {
  title: "InVitro Capital — Shareholder Dashboard",
  description:
    "Consolidated Financial Performance Dashboard for InVitro Capital Holdings",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
