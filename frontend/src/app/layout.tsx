import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";

const plusJakarta = Plus_Jakarta_Sans({ 
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  display: "swap"
});

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap"
});

export const metadata: Metadata = {
  title: "UPSC Intelligence Hub | Strategic Assets",
  description: "Advanced intelligence platform for UPSC civil services preparation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${plusJakarta.variable} ${inter.variable}`} suppressHydrationWarning>
      <body className="font-inter antialiased flex flex-col min-h-screen">
        <ThemeProvider>
          <div className="flex-grow">
            {children}
          </div>
          <footer className="py-20 border-t border-gray-100 dark:border-white/5 text-center mt-auto">
            <p className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-[0.4em] mb-3">
              Intelligence Directive Deployment
            </p>
            <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400">
              Made this for Special Person 
              <span className="text-blue-600 dark:text-blue-400 mx-2">"Amritha Anuragh"</span> 
              By <span className="text-yellow-500">Spider Man</span>
            </p>
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}
