// NotificationCard - Proactive AI priority notification from Mohammed code.html
// Shows urgent deadlines, closing applications, discovered opportunities

import { useState } from 'react';

export default function NotificationCard({ notification, onAction, onDismiss }) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const defaultNotification = {
    user: 'Student',
    university: 'KCL CS Y2',
    alerts: [
      { text: 'Databases due', urgency: 'high', time: 'Fri' },
      { text: 'Goldman closes', urgency: 'medium', time: 'tomorrow' },
      { text: '£3.4k DSA grant found', urgency: 'opportunity', time: null }
    ]
  };

  const data = notification || defaultNotification;

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  const getUrgencyColor = (urgency) => {
    switch (urgency) {
      case 'high': return 'text-red-400';
      case 'medium': return 'text-yellow-400';
      case 'opportunity': return 'text-white';
      default: return 'text-gray-400';
    }
  };

  return (
    <section className="animate-fade-in mb-8">
      <div className="border border-gray-700 p-6 relative">
        {/* Priority indicator */}
        <div className="flex items-center gap-2 mb-4">
          <span className="w-2 h-2 bg-white animate-pulse-subtle" />
          <span className="text-xs tracking-widest text-gray-400">PRIORITY UPDATE</span>
        </div>

        {/* Main message */}
        <div className="text-lg leading-relaxed mb-6 pl-4 border-l-2 border-gray-700 animate-border-glow">
          <span className="font-bold">{data.user}</span>
          <span className="text-gray-500"> ({data.university})</span>
          <span className="text-gray-400"> — </span>
          {data.alerts.map((alert, i) => (
            <span key={i}>
              {alert.text}
              {alert.time && (
                <span className={`${getUrgencyColor(alert.urgency)} ${
                  alert.urgency === 'high' ? 'animate-pulse-ultra' : 
                  alert.urgency === 'medium' ? 'animate-glow-yellow' : ''
                }`}> {alert.time}</span>
              )}
              {i < data.alerts.length - 1 && <span className="text-gray-600">. </span>}
            </span>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex gap-4">
          <button
            onClick={onAction}
            className="px-6 py-2 border border-white text-sm hover:bg-white hover:text-black transition-all"
          >
            [ Take Action ]
          </button>
          <button
            onClick={handleDismiss}
            className="px-6 py-2 border border-gray-700 text-sm text-gray-400 hover:border-gray-500 hover:text-white transition-all"
          >
            [ Dismiss ]
          </button>
        </div>
      </div>
    </section>
  );
}
