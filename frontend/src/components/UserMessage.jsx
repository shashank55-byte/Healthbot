import React from 'react';
import { motion } from 'framer-motion';

export default function UserMessage({ message }) {
  return (
    <motion.div
      className="row user"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.2 }}
    >
      <div className="bubble user">
        {message.text}
        <div className="timestamp">{new Date(message.ts || Date.now()).toLocaleTimeString()}</div>
      </div>
    </motion.div>
  );
}
