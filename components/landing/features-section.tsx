"use client"

import { motion } from "framer-motion"
import { Layers, Rocket, Shield, Smartphone, Terminal, Zap } from "lucide-react"

const features = [
  {
    title: "[Feature Name One]",
    description: "[Brief description of the first core feature, its benefits, and why it matters to the user.]",
    icon: Rocket,
    className: "col-span-1 md:col-span-2 row-span-1 bg-gradient-to-br from-primary/10 to-transparent border-primary/20",
  },
  {
    title: "[Feature Two]",
    description: "[Short and punchy feature explanation.]",
    icon: Zap,
    className: "col-span-1 md:col-span-1 row-span-1",
  },
  {
    title: "[Feature Three]",
    description: "[Highlight a unique selling point or competitive advantage here.]",
    icon: Layers,
    className: "col-span-1 md:col-span-1 row-span-2 bg-muted/40",
  },
  {
    title: "[Feature Four]",
    description: "[Describe security, speed, reliability, or specific metrics.]",
    icon: Shield,
    className: "col-span-1 md:col-span-1 row-span-1",
  },
  {
    title: "[Feature Five]",
    description: "[Mention integrations, API access, or developer experience.]",
    icon: Terminal,
    className: "col-span-1 md:col-span-1 row-span-1",
  },
  {
    title: "[Feature Six]",
    description: "[Focus on responsiveness, support, or cross-platform capabilities.]",
    icon: Smartphone,
    className: "col-span-1 md:col-span-1 row-span-1 bg-gradient-to-tr from-chart-4/10 to-transparent border-chart-4/20",
  },
]

export function FeaturesSection() {
  return (
    <section className="py-8 md:py-12 bg-background relative min-h-[calc(100vh-4rem)] flex items-center">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10 w-full">
        <div className="text-center max-w-3xl mx-auto mb-8 md:mb-16">
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
            [Section Headline Placeholder] <br className="sm:hidden" />
            <span className="text-primary">[Highlighted Text]</span>
          </h2>
          <p className="mt-4 text-sm md:text-lg text-muted-foreground">
            [A short, engaging subtitle explaining the overarching value of the features listed below.]
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
