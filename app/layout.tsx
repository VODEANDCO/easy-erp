import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";

// 본문 글꼴은 globals.css 의 --font-sans(한글 시스템 폰트)를 사용합니다.
// 코드·번호 표기용 고정폭 글꼴만 불러옵니다.
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Easy ERP",
    template: "%s | Easy ERP",
  },
  description: "엑셀보다 쉬운 소상공인 ERP",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
