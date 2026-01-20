import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Smash Your Week - Calendar Breakout Game",
  description: "Turn your calendar into a fun breakout game. Upload a screenshot and smash through your meetings!",
  keywords: ["breakout", "game", "calendar", "arcade", "productivity"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-[#0a0a1a] text-white font-sans">
        {children}
      </body>
    </html>
  );
}
