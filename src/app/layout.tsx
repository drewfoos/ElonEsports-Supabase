import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://elon-smash-pr.vercel.app"
  ),
  title: {
    default: "Elon Esports Smash PR",
    template: "%s | Elon Esports Smash PR",
  },
  description:
    "Super Smash Bros. Ultimate tournament tracker and power rankings for Elon University Esports",
  keywords: [
    "Smash Bros",
    "Elon University",
    "Esports",
    "Power Rankings",
    "Tournament",
    "SSBU",
  ],
  openGraph: {
    type: "website",
    siteName: "Elon Esports Smash PR",
    title: "Elon Esports Smash PR",
    description:
      "Super Smash Bros. Ultimate tournament tracker and power rankings for Elon University Esports",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Elon Esports Smash PR — Power Rankings leaderboard with animated hero and Smash character renders",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Elon Esports Smash PR",
    description:
      "Super Smash Bros. Ultimate tournament tracker and power rankings for Elon University Esports",
    images: ["/og-image.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
    ],
    apple: "/apple-icon.png",
  },
  manifest: "/site.webmanifest",
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "Elon University Esports Club",
              url: "https://elon-smash-pr.vercel.app",
              logo: "https://elon-smash-pr.vercel.app/icon.svg",
              description:
                "Super Smash Bros. Ultimate tournament tracker and power rankings for Elon University Esports",
              sameAs: [],
            }),
          }}
        />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
