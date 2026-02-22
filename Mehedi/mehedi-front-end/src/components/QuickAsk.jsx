// QuickAsk - AI assistant quick input from Mohammed code.html
// Allows quick questions to the AI

import { useState } from 'react';

export default function QuickAsk({ onAsk, loading, placeholder }) {
  const [input, setInput] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim() && !loading) {
      onAsk(input.trim());
      setInput('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="border border-gray-800 p-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4 mb-4">
        <div className="w-10 h-10 border border-gray-700 flex items-center justify-center">
          <span className="text-gray-400">◉</span>
        </div>
        <div>
          <h4 className="font-bold">beacon</h4>
          <p className="text-sm text-gray-500">AI Assistant</p>
        </div>
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="relative">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || "Ask beacon anything..."}
          disabled={loading}
          className="w-full bg-transparent border border-gray-800 py-3 px-4 pr-12
                     text-sm placeholder-gray-600 focus:border-gray-600 
                     focus:outline-none transition-colors disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 
                     hover:text-white transition-colors disabled:opacity-30 font-mono"
        >
          {loading ? '...' : '→'}
        </button>
      </form>
    </div>
  );
}
