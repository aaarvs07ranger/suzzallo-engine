import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Suzzallo Planner",
  description: "A calmer UW quarter-planning workspace for transcript review, visible tradeoffs, and schedule comparison.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
