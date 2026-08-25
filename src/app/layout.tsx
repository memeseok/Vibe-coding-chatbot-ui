import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "서초 AI",
  description: "서초 AI 챗봇",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
