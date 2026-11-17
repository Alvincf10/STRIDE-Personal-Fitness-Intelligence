import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "STRIDE — Personal Fitness Intelligence",
  description:
    "Your personal fitness companion. Running, recovery, coach guidance, and goals from your Garmin data.",
  applicationName: "STRIDE",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "STRIDE",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [{ url: "/stride-favicon.svg", type: "image/svg+xml" }],
    shortcut: ["/stride-favicon.svg"],
    apple: [{ url: "/apple-icon" }],
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#07140F" },
    { color: "#07140F" },
  ],
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${jakarta.variable} antialiased`}>{children}</body>
    </html>
  );
}
