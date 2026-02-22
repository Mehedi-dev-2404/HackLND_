// OpportunityCard - Job/Funding cards with keyboard accessibility
import { useState } from 'react';

export default function OpportunityCard({ opportunity, onApply }) {
  const [focused, setFocused] = useState(false);

  const {
    type = 'job',
    title,
    subtitle,
    badge,
    matchScore,
    amount,
    available,
    actionText = 'Apply Now'
  } = opportunity;

  const isJob = type === 'job';

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      onApply?.(opportunity);
    }
  };

  return (
    <div 
      role="button"
      tabIndex="0"
      onKeyDown={handleKeyDown}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      className={`border p-6 hover:shadow-lg hover:shadow-white/5 transition-all group animate-fade-in cursor-pointer
                   ${focused ? 'border-gray-600 shadow-lg shadow-white/5' : 'border-gray-800 hover:border-gray-600'}`}>
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-4">
          {/* Icon */}
          <div className={`w-12 h-12 border flex items-center justify-center
                          ${isJob ? 'border-gray-700' : 'border-gray-700'}`}>
            <span className="text-gray-400 text-xl">
              {isJob ? '◈' : '$'}
            </span>
          </div>
          
          {/* Title */}
          <div>
            <h4 className="font-bold text-lg">{title}</h4>
            <p className="text-sm text-gray-500">{subtitle}</p>
            {badge && (
              <span className="inline-block mt-1 text-xs text-gray-500 border border-gray-700 px-2 py-0.5">
                {badge}
              </span>
            )}
          </div>
        </div>

        {/* Match score or availability */}
        {matchScore && (
          <div className="text-xs border border-gray-700 px-3 py-1">
            {matchScore}% Match
          </div>
        )}
        {available && (
          <div className="text-xs border border-gray-700 px-3 py-1 text-gray-400">
            Available
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        {/* Amount for funding */}
        {amount && (
          <div>
            <span className="text-2xl font-bold">{amount}</span>
            <span className="text-sm text-gray-500 ml-2">max available</span>
          </div>
        )}

        {/* Avatars for jobs */}
        {isJob && (
          <div className="flex -space-x-2">
            <div className="w-8 h-8 border border-gray-700 bg-gray-900 flex items-center justify-center text-xs">
              JD
            </div>
            <div className="w-8 h-8 border border-gray-700 bg-gray-900 flex items-center justify-center text-xs">
              AK
            </div>
          </div>
        )}

        {/* Action button */}
        <button
          onClick={() => onApply?.(opportunity)}
          className="flex items-center gap-2 text-white hover:gap-3 transition-all text-sm"
        >
          {actionText}
          <span>→</span>
        </button>
      </div>
    </div>
  );
}
