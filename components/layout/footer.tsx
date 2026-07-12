import Link from "next/link"
import Image from "next/image"
import { navigationLinks } from "@/lib/navigation"

const COPYRIGHT_YEAR = 2026

export function Footer() {
  return (
    <footer className="border-t border-border/40 bg-muted/20 pb-8 pt-16 mt-auto">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-4 xl:grid-cols-5">
          <div className="xl:col-span-2 flex flex-col gap-4">
            <Link href="/" className="flex items-center space-x-2 cursor-pointer">
              <Image src="/logo.svg" alt="Odoo" width={24} height={24} className="w-6 h-6 group-hover:opacity-80 transition-opacity" />
              <span className="font-bold text-xl">Odoo</span>
            </Link>
            <p className="text-muted-foreground text-sm max-w-xs leading-relaxed">
              The ultimate boilerplate for shipping high-performance Next.js applications faster than ever before.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 xl:col-span-3">
            <div className="flex flex-col gap-3">
              <h3 className="font-semibold text-foreground">Navigation</h3>
              {navigationLinks.map((link) => (
                <Link key={link.href} href={link.href} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors cursor-pointer">
                  <link.icon className="h-4 w-4" /> {link.title}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-16 border-t border-border/40 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            &copy; {COPYRIGHT_YEAR} Odoo Core Team. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <span className="flex h-2 w-2 rounded-none bg-green-500 animate-pulse" />
            <span className="text-sm text-muted-foreground">All systems operational</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
