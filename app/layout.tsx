import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";

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

/**
 * True app shell: fonts, theme bootstrapping, toaster. No navbar/footer here
 * — those are page-group-specific chrome now. Public pages (landing, auth)
 * get Navbar+Footer from app/(public)/layout.tsx; authenticated pages get
 * the sidebar shell from app/(protected)/layout.tsx.
 */
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const initialTheme = getThemeCookie(cookieStore.get("odoo_theme")?.value);

  return (
    <html
      lang="en"
      className={cn("font-sans", fontSans.variable, initialTheme === "dark" && "dark")}
      style={{ colorScheme: initialTheme }}
    >
      <body
        className={`${fontSans.variable} ${fontHeading.variable} ${fontMono.variable} antialiased min-h-screen text-sm`}
      >
        <ThemeProvider initialTheme={initialTheme}>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
