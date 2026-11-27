import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

const notoSans = localFont({
  src: [
    {
      path: "../assets/fonts/NotoSans-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../assets/fonts/NotoSans-Bold.ttf",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Quick Invoice — Simple GST Invoicing & Razorpay Payments",
  description:
    "Create GST invoices, email PDFs from your business account, and collect online payments via Razorpay.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={notoSans.variable}>
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}
