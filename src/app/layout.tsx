import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ShapeOSIntro } from "@/components/brand/shapeos-intro";
import { createIntroBootstrap } from "@/components/brand/shapeos-intro.config";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ShapeOS",
  description: "Organize sua alimentação, registre os treinos e acompanhe peso e medidas no ShapeOS.",
  icons: {
    icon: [
      { url: "/icon.png", type: "image/png" },
      { url: "/shapeos-icon.png", type: "image/png" },
    ],
    apple: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script dangerouslySetInnerHTML={{ __html: createIntroBootstrap() }} />
        {/* Cards only rise into place when the page opens in view; a page opened hidden shows them at rest. */}
        <script dangerouslySetInnerHTML={{ __html: 'if(document.visibilityState==="visible")document.documentElement.dataset.motion="on"' }} />
        <ShapeOSIntro>{children}</ShapeOSIntro>
      </body>
    </html>
  );
}
