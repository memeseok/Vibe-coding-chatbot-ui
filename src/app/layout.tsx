import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "서초 AI | Google로 시작하는 AI 대화",
  description: "Google 계정으로 로그인해 사용하는 개인 AI 챗봇",
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
