import React from 'react';
import { motion } from 'framer-motion';

export default function TypingIndicator() {
  return (
    <div className="row bot">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="bubble bot"
      >
        <motion.span
          className="dot"
          initial={{ scale: 0.9, opacity: 0.7 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
        ></motion.span>
        <motion.span
          className="dot"
          initial={{ scale: 0.9, opacity: 0.7 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.7 }}
        ></motion.span>
        <motion.span
          className="dot"
          initial={{ scale: 0.9, opacity: 0.7 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.9 }}
        ></motion.span>
      </motion.div>
    </div>
  );
}
