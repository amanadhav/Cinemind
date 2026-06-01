import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en" className="dark">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
