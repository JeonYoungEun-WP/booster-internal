import type { Metadata } from "next";
import { GNB } from "@/src/components/layout/GNB";
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
      <body>
        <GNB />
        {children}
      </body>
    </html>
  );
}
