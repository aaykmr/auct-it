import type { Metadata } from "next";
import { Metrophobic, Poppins } from "next/font/google";
import { Providers } from "@/components/providers";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  variable: "--font-poppins",
  weight: ["400", "500", "600", "700"],
});

const metrophobic = Metrophobic({
  subsets: ["latin"],
  variable: "--font-metrophobic",
  weight: "400",
});

export const metadata: Metadata = {
  title: "AuctIt — Live auctions",
  description: "Online auctions by city and category",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${poppins.variable} ${metrophobic.variable} min-h-screen font-sans text-base antialiased md:text-[17px]`}
      >
        <Providers>
          <SiteHeader />
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
