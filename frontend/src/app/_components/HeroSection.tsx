"use client";
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";

export function HeroSection() {
  const reduce = useReducedMotion();
  return (
    <motion.section
      initial={reduce ? false : { opacity: 0, y: 20 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto grid max-w-7xl gap-16 px-6 py-20 md:grid-cols-[1.1fr_1fr] md:py-28"
    >
      <div className="flex flex-col justify-center">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">
          Live availability · 15s sync
        </p>
        <h1 className="mt-6 text-5xl font-medium leading-[1.02] tracking-tighter md:text-7xl">
          Book seats
          <br />
          without the
          <br />
          <span className="text-accent">rush.</span>
        </h1>
        <p className="mt-8 max-w-[58ch] text-base leading-relaxed text-muted">
          Velaris holds your seat for ten minutes the moment you choose it.
          Confirm once, and the ticket is yours. No queues, no double-bookings,
          no surprise sold-outs.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Link
            href="/events"
            className="inline-flex h-11 items-center justify-center rounded-md bg-accent px-5 text-sm font-medium text-accent-foreground transition-all hover:bg-accent-hover active:translate-y-px"
          >
            Browse events
          </Link>
          <Link
            href="/auth/login"
            className="inline-flex h-11 items-center justify-center rounded-md border border-line bg-surface px-5 text-sm font-medium text-foreground transition-colors hover:bg-subtle"
          >
            I have an account
          </Link>
        </div>
      </div>
      <div className="relative aspect-video overflow-hidden rounded-xl bg-subtle">
        <Image
          src="https://picsum.photos/seed/velaris-hero/800/500"
          alt="Concert crowd"
          fill
          className="object-cover"
          priority
        />
      </div>
    </motion.section>
  );
}