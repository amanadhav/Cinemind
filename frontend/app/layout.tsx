import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CineMind — Personalized Movie Recommendations",
  description:
    "Hybrid movie recommender combining content-based filtering and real-time collaborative filtering (SVD matrix factorization).",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${plusJakartaSans.variable}`}>
      <body className="film-grain min-h-screen font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
