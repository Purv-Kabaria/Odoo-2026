"use client"

import { motion } from "framer-motion"
import { Loader2 } from "lucide-react"

export default function Loading() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center bg-background">
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-center gap-6"
      >
        <div className="relative flex h-20 w-20 items-center justify-center bg-card shadow-sm border border-border">
          <Loader2 className="h-8 w-8 animate-spin text-primary relative z-10" />
          
          <motion.div 
            className="absolute inset-0 border border-primary/30"
            animate={{ 
              scale: [1, 1.2, 1], 
              opacity: [0.5, 0, 0.5] 
            }}
            transition={{ 
              duration: 2, 
              repeat: Infinity, 
              ease: "easeInOut" 
            }}
          />
          <motion.div 
            className="absolute inset-0 bg-primary/5"
            animate={{ 
              scale: [1, 1.1, 1], 
            }}
            transition={{ 
              duration: 1.5, 
              repeat: Infinity, 
              ease: "easeInOut" 
            }}
          />
        </div>
        
        <div className="flex flex-col items-center gap-1.5 text-center">
          <h3 className="text-sm font-semibold tracking-tight text-foreground">
            Loading Interface
          </h3>
          <p className="text-xs text-muted-foreground max-w-[200px]">
            Preparing the experience. Please hold on a moment...
          </p>
        </div>
      </motion.div>
    </div>
  )
}
