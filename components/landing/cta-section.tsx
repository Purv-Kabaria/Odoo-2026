"use client"

import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { ArrowRight, Rocket, Sparkles, Code } from "lucide-react"

export function CTASection() {
  return (
    <section className="py-12 md:py-24 relative overflow-hidden min-h-[calc(100vh-4rem)] flex items-center justify-center bg-background">
      {/* Dynamic Grid Background */}
      <div className="absolute inset-0 -z-10 h-full w-full bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_50%,#000_20%,transparent_100%)]"></div>
      
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10 w-full flex items-center justify-center h-full">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          whileInView={{ opacity: 1, scale: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, type: "spring", bounce: 0.3 }}
          className="rounded-none bg-card/90 backdrop-blur-xl border border-border p-8 md:p-16 text-center overflow-hidden relative shadow-xl shadow-foreground/5 w-full flex flex-col items-center justify-center min-h-[65vh] md:min-h-[75vh]"
        >
          {/* Mesmerizing abstract background elements */}
          <motion.div animate={{ rotate: 360, scale: [1, 1.1, 1] }} transition={{ duration: 15, repeat: Infinity, ease: "linear" }} className="absolute top-0 right-0 -mt-10 -mr-10 w-[15rem] md:w-[25rem] h-[15rem] md:h-[25rem] bg-primary/10 rounded-none blur-3xl pointer-events-none" />
          <motion.div animate={{ rotate: -360, scale: [1, 1.2, 1] }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }} className="absolute bottom-0 left-0 -mb-10 -ml-10 w-[15rem] md:w-[25rem] h-[15rem] md:h-[25rem] bg-primary/10 rounded-none blur-3xl pointer-events-none" />
          <motion.div animate={{ y: [-15, 15, -15] }} transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] bg-primary/5 rounded-none blur-2xl pointer-events-none" />

          {/* Icon Cluster UI */}
          <div className="inline-flex items-center justify-center gap-4 mb-10 relative z-10">
            <div className="flex items-center justify-center size-12 md:size-14 rounded-none bg-primary/10 text-primary border border-primary/20 shadow-sm">
              <Rocket className="size-6 md:size-7" />
            </div>
            <div className="flex items-center justify-center size-16 md:size-20 rounded-none bg-primary text-primary-foreground shadow-lg shadow-primary/25 ring-4 ring-primary/20">
              <Sparkles className="size-8 md:size-10" />
            </div>
            <div className="flex items-center justify-center size-12 md:size-14 rounded-none bg-primary/10 text-primary border border-primary/20 shadow-sm">
              <Code className="size-6 md:size-7" />
            </div>
          </div>

          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl lg:text-6xl relative z-10 max-w-3xl mx-auto leading-tight mb-4">
            <span className="text-transparent bg-clip-text bg-gradient-to-br from-foreground to-foreground/70">
              [Call to Action Headline]
            </span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm md:text-base lg:text-lg leading-relaxed text-muted-foreground relative z-10 font-medium">
            [A compelling description urging the user to take the next step. Explain the immediate value they get by clicking the button below.]
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 relative z-10">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="w-full sm:w-auto">
              <Button size="lg" className="w-full rounded-none font-bold cursor-pointer group shadow-lg shadow-primary/20 px-10 h-14 md:h-16 text-base md:text-lg transition-colors border border-primary relative overflow-hidden">
                <span className="relative z-10 flex items-center text-primary-foreground">
                  <span className="flex h-1.5 w-1.5 rounded-none bg-primary-foreground animate-pulse mr-3" />
                  [Primary Action] <ArrowRight className="ml-2 size-5 md:size-6 group-hover:translate-x-1 transition-transform" />
                </span>
                <div className="absolute inset-0 bg-primary opacity-100 group-hover:opacity-90 transition-opacity" />
              </Button>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
