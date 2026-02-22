import { useMemo } from 'react';

export default function MatchPanel({ analysis, onStartSocratic }) {
  const { matchScore, strengths, missing } = useMemo(() => {
    if (!analysis) return { matchScore: 0, strengths: [], missing: [] };

    const allSkills = [
      ...analysis.technical_skills,
      ...analysis.tools_technologies,
      ...analysis.cognitive_skills,
      ...analysis.behavioural_traits,
    ];

    // Mock user skills for demo - in production, this would come from user profile
    const userSkills = ['Python', 'JavaScript', 'Problem-solving', 'Team player', 'Communication'];
    
    const matchedSkills = allSkills.filter(skill => 
      userSkills.some(us => us.toLowerCase().includes(skill.toLowerCase()) || 
                          skill.toLowerCase().includes(us.toLowerCase()))
    );
    
    const missingSkills = allSkills.filter(skill => 
      !userSkills.some(us => us.toLowerCase().includes(skill.toLowerCase()) || 
                            skill.toLowerCase().includes(us.toLowerCase()))
    );

    const score = allSkills.length > 0 
      ? Math.round((matchedSkills.length / allSkills.length) * 100)
      : 0;

    return {
      matchScore: score,
      strengths: matchedSkills.length > 0 ? matchedSkills : ['Analytical thinking', 'Quick learner'],
      missing: missingSkills,
    };
  }, [analysis]);

  if (!analysis) return null;

  return (
    <section className="animate-fade-in mt-8">
      <div className="border border-white p-6">
        <div className="flex items-center gap-2 mb-6">
          <span className="text-terminal-dim">$</span>
          <h2 className="text-lg font-medium">analysis_result</h2>
        </div>

        {/* Match Score */}
        <div className="mb-6">
          <div className="flex items-baseline gap-4 mb-2">
            <span className="text-terminal-dim text-sm">match_score:</span>
            <span className="text-4xl font-bold">{matchScore}%</span>
          </div>
          <div className="w-full h-1 bg-terminal-gray">
            <div 
              className="h-full bg-white transition-all duration-1000"
              style={{ width: `${matchScore}%` }}
            />
          </div>
        </div>

        {/* Experience Level */}
        <div className="mb-6 pb-4 border-b border-terminal-gray">
          <span className="text-terminal-dim text-sm">experience_level: </span>
          <span className="text-white">{analysis.experience_level}</span>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Strengths */}
          <div>
            <div className="text-terminal-dim text-sm mb-2">// strengths</div>
            <ul className="space-y-1">
              {strengths.map((skill, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="text-terminal-dim">+</span>
                  <span>{skill}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Missing Skills */}
          <div>
            <div className="text-terminal-dim text-sm mb-2">// gaps_to_address</div>
            <ul className="space-y-1">
              {missing.length > 0 ? missing.map((skill, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="text-terminal-dim">-</span>
                  <span className="text-terminal-dim">{skill}</span>
                </li>
              )) : (
                <li className="text-terminal-dim">No significant gaps detected</li>
              )}
            </ul>
          </div>
        </div>

        {/* Start Socratic Button */}
        <div className="mt-8 pt-6 border-t border-terminal-gray">
          <button
            onClick={onStartSocratic}
            className="w-full py-3 border border-white font-mono text-sm hover:bg-white hover:text-black transition-all"
          >
            [ Start Socratic Mode ]
          </button>
        </div>
      </div>
    </section>
  );
}
