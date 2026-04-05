import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Lighthouse — AI 驱动的一站式信息平台",
  description: "发现 AI 工具，捕捉需求，从想法到落地",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className="dark">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
