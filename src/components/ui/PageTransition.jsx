import React from 'react';
import { motion } from 'framer-motion';

// Lightweight enter animation wrapper for page content. Applied in the Layout
// main area keyed by page name so each navigation fades/slides in smoothly.
export default function PageTransition({ children, pageKey }) {
  return (
    <motion.div
      key={pageKey}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}