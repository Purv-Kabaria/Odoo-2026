import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { getCurrentUser } from "@/lib/auth";

const fontSans = Inter({ subsets: ['latin'], variable: '--font-sans' });

const fontHeading = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-heading",
});

const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: {
    default: "AssetFlow",
    template: "%s | AssetFlow",
  },
  description: "Enterprise asset & resource management — track, allocate, and maintain every asset your organization owns.",
};

type Theme = "light" | "dark";

function getThemeCookie(value: string | undefined): Theme {
  return value === "dark" ? "dark" : "light";
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const initialTheme = getThemeCookie(cookieStore.get("odoo_theme")?.value);
  const user = await getCurrentUser();

  return (
    <html
      lang="en"
      className={cn("font-sans", fontSans.variable, initialTheme === "dark" && "dark")}
      style={{ colorScheme: initialTheme }}
    >
      <body
        className={`${fontSans.variable} ${fontHeading.variable} ${fontMono.variable} antialiased flex min-h-screen flex-col text-sm`}
      >
        <ThemeProvider initialTheme={initialTheme}>
          <Navbar user={user} />
          <div className="flex-1">
            {children}
          </div>
          <Footer />
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
