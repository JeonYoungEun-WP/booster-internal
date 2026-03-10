import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Booster Internal",
  description: "KPI & Task Management",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
