import { useState } from 'react';

export default function JobInput({ onAnalyze, loading }) {
  const [jobText, setJobText] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (jobText.trim() && !loading) {
      onAnalyze(jobText);
    }
  };

  return (
    <section className="animate-fade-in">
      <div className="border border-white p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-terminal-dim">$</span>
          <h2 className="text-lg font-medium">paste_job_description</h2>
        </div>
        
        <form onSubmit={handleSubmit}>
          <textarea
            value={jobText}
            onChange={(e) => setJobText(e.target.value)}
            placeholder="Paste the job description here..."
            className="w-full h-48 bg-black border border-terminal-gray p-4 font-mono text-sm text-white placeholder-terminal-dim focus:border-white transition-colors"
            disabled={loading}
          />
          
          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={loading || !jobText.trim()}
              className={`px-6 py-2 border font-mono text-sm transition-all ${
                loading || !jobText.trim()
                  ? 'border-terminal-gray text-terminal-dim cursor-not-allowed'
                  : 'border-white text-white hover:bg-white hover:text-black'
              }`}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="animate-blink">▌</span>
                  analysing...
                </span>
              ) : (
                '[ Analyse ]'
              )}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
