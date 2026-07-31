"use client";

import { motion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

/** Slow, slightly weighted easing — clay doesn't snap. */
export const ease = [0.22, 0.61, 0.36, 1] as const;

export const riseVariants: Variants = {
  hidden: { opacity: 0, y: 26 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease } },
};

export const staggerVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
};

type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "section" | "li" | "figure" | "header";
};

/** One-shot scroll reveal. Fires a little before the element is centred. */
export function Reveal({ children, className, delay = 0, as = "div" }: RevealProps) {
  const Tag = motion[as];
  return (
    <Tag
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-12% 0px -12% 0px" }}
      variants={{
        hidden: { opacity: 0, y: 26 },
        show: { opacity: 1, y: 0, transition: { duration: 0.7, ease, delay } },
      }}
    >
      {children}
    </Tag>
  );
}

/** Wrap a group; children using `riseVariants` will cascade. */
export function RevealGroup({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-10% 0px -10% 0px" }}
      variants={staggerVariants}
    >
      {children}
    </motion.div>
  );
}
