"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import dynamic from "next/dynamic"
const Player = dynamic(() => import("@lottiefiles/react-lottie-player").then((mod) => mod.Player), { ssr: false })
import { Button } from "@/components/ui/button"
import { ArrowRight, ChevronRight, LogIn } from "lucide-react"

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-background min-h-[calc(100vh-4rem)] flex items-center py-12 md:py-0">
      {/* Animated background grid */}
      <div className="absolute inset-0 -z-10 h-full w-full bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"></div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row items-center gap-16">

          <div className="flex-1 text-center lg:text-left">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-medium text-primary mb-6 shadow-sm cursor-pointer hover:bg-primary/20 transition-colors group"
            >
              <span className="flex h-2 w-2 rounded-full bg-primary mr-2 animate-pulse"></span>
              No more spreadsheets or paper logs
              <ChevronRight className="ml-1 size-4 group-hover:translate-x-1 transition-transform" />
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl mb-6"
            >
              Every asset, tracked end-to-end. <br className="hidden lg:block" />
              <span className="text-transparent bg-clip-text bg-primary">AssetFlow</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-base md:text-lg text-muted-foreground mb-10 max-w-2xl mx-auto lg:mx-0 leading-relaxed"
            >
              Register assets, allocate them without double-booking, book shared resources by the minute, and route maintenance and audits through real approval workflows — all from one dashboard.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start"
            >
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="w-full sm:w-auto">
                <Button asChild size="lg" className="px-8 h-12 w-full shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all cursor-pointer group">
                  <Link href="/signup">
                    Get Started <ArrowRight className="ml-2 size-4 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </Button>
              </motion.div>

              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="w-full sm:w-auto">
                <Button asChild variant="outline" size="lg" className="px-8 h-12 w-full shadow-sm hover:bg-muted/80 transition-all cursor-pointer group">
                  <Link href="/login">
                    <LogIn className="mr-2 size-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    Sign In
                  </Link>
                </Button>
              </motion.div>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9, rotate: -2 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="hidden lg:flex flex-1 w-full max-w-lg lg:max-w-none relative items-center justify-center"
          >
            <div className="w-full aspect-square md:aspect-video lg:aspect-square flex items-center justify-center p-4">
              <Player
                src="/hero-animation.json"
                loop
                autoplay
                className="w-full h-full object-contain drop-shadow-2xl transition-all duration-500 hover:scale-105"
              />
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  )
}
