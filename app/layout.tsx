import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { TopNav } from "@/components/TopNav";
import "./globals.css";

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
});

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-sans",
});

export const metadata: Metadata = {
  title: "MEDREG RADAR — 의료 오픈소스 활동 모니터",
  description:
    "분야별로 정리한 의료·의료기기 오픈소스 프로젝트의 활동 현황을 계속 확인할 수 있는 대시보드",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className={`${plexMono.variable} ${plexSans.variable} font-sans bg-paper text-ink antialiased`}>
        <TopNav />
        {children}
      </body>
    </html>
  );
}
