import type { Metadata } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono, Lora } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

const lora = Lora({
  variable: "--font-serif",
  subsets: ["latin"],
  display: "swap",
  style: ["italic", "normal"],
});

export const metadata: Metadata = {
  title: "Arsip 3 Tahun — Kenangan Kelulusan",
  description:
    "Sebuah arsip kenangan dan pengakuan perpisahan kelas, dirancang dengan estetika Figma Design Canvas dan kinetic typography.",
  keywords: [
    "kenangan",
    "kelulusan",
    "perpisahan",
    "surat cinta untuk starla",
    "kinetic lyrics",
  ],
  authors: [{ name: "Arsip 3 Tahun" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body
        className={`${jakarta.variable} ${jetbrains.variable} ${lora.variable} antialiased bg-background text-foreground font-sans`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
