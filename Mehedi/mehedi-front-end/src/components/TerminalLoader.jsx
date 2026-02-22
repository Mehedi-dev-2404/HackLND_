// TerminalLoader - Typewriter-style loading indicator
import { useState, useEffect } from 'react';

export default function TerminalLoader({ messages = [], active = true }) {
  const [displayText, setDisplayText] = useState('');
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);

  const defaultMessages = [
    'initializing_beacon…',
    'loading_priority_engine…',
    'analyzing_opportunities…',
    'system_ready'
  ];

  const messagesToShow = messages.length ? messages : defaultMessages;
  const currentMessage = messagesToShow[currentMessageIndex];

  useEffect(() => {
    if (!active) return;

    let index = 0;
    const typeInterval = setInterval(() => {
      if (index < currentMessage.length) {
        setDisplayText(currentMessage.substring(0, index + 1));
        index++;
      } else {
        clearInterval(typeInterval);
        // Move to next message after 500ms
        setTimeout(() => {
          if (currentMessageIndex < messagesToShow.length - 1) {
            setCurrentMessageIndex(currentMessageIndex + 1);
            setDisplayText('');
          }
        }, 500);
      }
    }, 30);

    return () => clearInterval(typeInterval);
  }, [currentMessage, currentMessageIndex, active, messagesToShow]);

  if (!active) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="font-mono text-sm text-gray-400">
        <span>{displayText}</span>
        <span className="animate-pulse-subtle">▌</span>
      </div>
    </div>
  );
}
