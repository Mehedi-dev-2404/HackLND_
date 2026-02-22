// useCountUp - Smooth animated counter for numbers
import { useState, useEffect } from 'react';

export function useCountUp(target, duration = 1000) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!target) return;

    const steps = 60;
    const increment = target / steps;
    const stepDuration = duration / steps;
    let current = 0;

    const interval = setInterval(() => {
      current += increment;
      if (current >= target) {
        setCount(target);
        clearInterval(interval);
      } else {
        setCount(Math.floor(current));
      }
    }, stepDuration);

    return () => clearInterval(interval);
  }, [target, duration]);

  return count;
}

// useSystemStatus - Check backend health
export function useSystemStatus() {
  const [status, setStatus] = useState('online'); // 'online' | 'degraded'

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetch('/api/socratic', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic: 'test', previous_answer: null }),
        });
        setStatus(response.ok ? 'online' : 'degraded');
      } catch {
        setStatus('degraded');
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, []);

  return status;
}
