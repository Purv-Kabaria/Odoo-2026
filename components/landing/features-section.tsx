"use client"

import { motion } from "framer-motion"
import { ArrowLeftRight, Boxes, CalendarCheck, ClipboardCheck, Gauge, Wrench } from "lucide-react"

const features = [
  {
    title: "Full asset lifecycle tracking",
    description: "Every asset moves through a clear lifecycle — Available, Allocated, Reserved, Under Maintenance, Lost, Retired, Disposed — with a full history of who held it and what changed.",
    icon: Boxes,
    className: "col-span-1 md:col-span-2 row-span-1 bg-gradient-to-br from-primary/10 to-transparent border-primary/20",
  },
  {
    title: "No more double-allocation",
    description: "Allocating an asset that's already taken gets blocked automatically, with a one-click transfer request instead of a dead end.",
    icon: ArrowLeftRight,
    className: "col-span-1 md:col-span-1 row-span-1",
  },
  {
    title: "Conflict-free resource booking",
    description: "Book rooms, vehicles, and shared equipment by time slot. Overlapping requests are rejected before they ever reach a calendar.",
    icon: CalendarCheck,
    className: "col-span-1 md:col-span-1 row-span-2 bg-muted/40",
  },
  {
    title: "Maintenance, gated by approval",
    description: "Repairs route through an approval workflow before work starts, so an asset only flips to Under Maintenance once someone signs off.",
    icon: Wrench,
    className: "col-span-1 md:col-span-1 row-span-1",
  },
  {
    title: "Structured audit cycles",
    description: "Assign auditors, verify assets against expected locations, and get a discrepancy report generated automatically.",
    icon: ClipboardCheck,
    className: "col-span-1 md:col-span-1 row-span-1",
  },
  {
    title: "Real-time KPI dashboard",
    description: "Overdue returns, pending transfers, and upcoming bookings surface the moment they matter, not after someone goes looking.",
    icon: Gauge,
    className: "col-span-1 md:col-span-1 row-span-1 bg-gradient-to-tr from-chart-4/10 to-transparent border-chart-4/20",
  },
]

export function FeaturesSection() {
  return (
    <section className="py-8 md:py-12 bg-background relative min-h-[calc(100vh-4rem)] flex items-center">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10 w-full">
        <div className="text-center max-w-3xl mx-auto mb-8 md:mb-16">
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
            Stop tracking assets in spreadsheets. <br className="sm:hidden" />
            <span className="text-primary">Start tracking them properly.</span>
          </h2>
          <p className="mt-4 text-sm md:text-lg text-muted-foreground">
            AssetFlow replaces scattered logs and manual handoffs with structured workflows for allocation, booking, maintenance, and audits.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 auto-rows-[minmax(140px,auto)] md:auto-rows-[minmax(200px,auto)]">
          {features.map((feature, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              className={`group relative overflow-hidden rounded-xl border border-border bg-card p-5 hover:border-foreground/30 transition-all duration-300 shadow-sm hover:shadow-md cursor-pointer flex flex-col ${feature.className}`}
            >
              <div className="flex flex-col h-full relative z-10">
                <div className="mb-auto">
                  <div className="inline-flex items-center justify-center rounded-full bg-background/50 backdrop-blur-md p-3 shadow-sm border border-border/50 mb-6 group-hover:scale-110 transition-transform duration-300 text-foreground">
                    <feature.icon className="size-6" />
                  </div>
                  <h3 className="text-lg md:text-xl font-semibold mb-3 tracking-tight">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
                </div>
              </div>

              {/* Subtle hover gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-foreground/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
