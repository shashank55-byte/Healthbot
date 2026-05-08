import React from 'react';
import { AnimatePresence } from 'framer-motion';
import BotMessageCard from './BotMessageCard';
import UserMessage from './UserMessage';
import TypingIndicator from './TypingIndicator';

export default function ChatContainer({ messages, loading, showLoader, onCall, onFind }) {
  return (
    <div className="chat">
      <AnimatePresence initial={false}>
        {messages.map((m, i) => (
          m.role === 'bot'
            ? (m.meta ? <BotMessageCard key={i} message={m} onCall={onCall} onFind={onFind} /> : null)
            : <UserMessage key={i} message={m} />
        ))}
      </AnimatePresence>
      {showLoader && <TypingIndicator />}
    </div>
  );
}
