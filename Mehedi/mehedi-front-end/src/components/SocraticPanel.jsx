import { useState, useEffect, useRef } from 'react';
import { speakText, stopSpeech } from '../api';

export default function SocraticPanel({ 
  question, 
  loading, 
  onSubmitAnswer,
  topic
}) {
  const [answer, setAnswer] = useState('');
  const [displayedQuestion, setDisplayedQuestion] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const textareaRef = useRef(null);

  // Typewriter effect for questions
  useEffect(() => {
    if (!question) return;

    stopSpeech();
    setIsTyping(true);
    setDisplayedQuestion('');
    let index = 0;
    
    const typeInterval = setInterval(() => {
      if (index < question.length) {
        setDisplayedQuestion(prev => prev + question[index]);
        index++;
      } else {
        clearInterval(typeInterval);
        setIsTyping(false);
        // Auto-play voice after typing completes
        setIsSpeaking(true);
        speakText(question, () => setIsSpeaking(false));
      }
    }, 25);

    return () => {
      clearInterval(typeInterval);
      stopSpeech();
    };
  }, [question]);

  // Focus textarea after question finishes typing
  useEffect(() => {
    if (!isTyping && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isTyping]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (answer.trim() && !loading && !isTyping) {
      stopSpeech();
      onSubmitAnswer(answer);
      setAnswer('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <section className="animate-fade-in">
      {/* Topic Badge */}
      <div className="mb-6">
        <span className="text-gray-600 text-xs">topic: </span>
        <span className="text-gray-400 text-sm">{topic}</span>
      </div>

      {/* Question Display */}
      <div className="mb-8 p-6 border border-gray-800 min-h-[140px]">
        <div className="text-gray-600 text-xs mb-3">// question</div>
        <div className="text-xl leading-relaxed">
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="animate-pulse-subtle">▌</span>
              <span className="text-gray-500">generating...</span>
            </span>
          ) : (
            <>
              {displayedQuestion}
              {isTyping && <span className="typewriter-cursor">▌</span>}
            </>
          )}
        </div>
        
        {/* Voice Indicator */}
        {isSpeaking && (
          <div className="mt-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span className="text-gray-500 text-xs">speaking...</span>
          </div>
        )}
      </div>

      {/* Answer Input */}
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <div className="text-gray-600 text-xs mb-2">// your_response</div>
          <textarea
            ref={textareaRef}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="type your answer here..."
            disabled={loading || isTyping}
            className="w-full h-28 bg-black border border-gray-800 p-4 font-mono text-sm text-white placeholder-gray-600 focus:border-white focus:outline-none transition-colors disabled:opacity-50 resize-none"
          />
        </div>

        <div className="flex justify-between items-center">
          <div className="text-gray-600 text-xs">
            {isTyping ? 'listening...' : 'enter to submit / shift+enter for newline'}
          </div>
          <button
            type="submit"
            disabled={loading || isTyping || !answer.trim()}
            className={`px-8 py-2 border text-sm transition-all ${
              loading || isTyping || !answer.trim()
                ? 'border-gray-800 text-gray-600 cursor-not-allowed'
                : 'border-white text-white hover:bg-white hover:text-black'
            }`}
          >
            {loading ? 'thinking...' : '[ Next ]'}
          </button>
        </div>
      </form>
    </section>
  );
}
