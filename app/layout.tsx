import Provider from "@/components/Provider";
import { Toaster } from "@/components/ui/sonner";
import type { Metadata } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://fittingin.co";
const siteName = "Fitting In";
const description = "The fitness platform built to help you grow.";
const previewImage = `${siteUrl}/images/share_card.png`;
const pwaIcon = "/favicon_black.ico";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteName,
    template: `%s | ${siteName}`,
  },
  description,
  openGraph: {
    title: siteName,
    description,
    url: siteUrl,
    siteName,
    locale: "en_US",
    type: "website",
    images: [
      {
        url: previewImage,
        width: 1200,
        height: 630,
        alt: "Preview of Fitting In",
      },
    ],
  },
  themeColor: "#050505",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico" },
    ],
    apple: [{ url: pwaIcon, sizes: "180x180" }],
  },
  appleWebApp: {
    capable: true,
    title: siteName,
    statusBarStyle: "black-translucent",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased font-sans">
        <Provider>
          {children}
          <Toaster />
        </Provider>
      </body>
    </html>
  );
}
