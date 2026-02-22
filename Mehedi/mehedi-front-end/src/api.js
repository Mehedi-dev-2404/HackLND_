// Uses Vite proxy to forward /api/* requests to localhost:8000
// This avoids CORS issues during development
const API_BASE = '/api';

export async function analyzeCareer(jobText) {
  try {
    const response = await fetch(`${API_BASE}/career-analysis`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ job_text: jobText }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      const errorMsg = errorData?.detail || `Server error: ${response.status} ${response.statusText}`;
      throw new Error(errorMsg);
    }

    return await response.json();
  } catch (err) {
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      throw new Error('Cannot connect to backend. Is it running on localhost:8000?');
    }
    throw err;
  }
}

export async function getSocraticQuestion(topic, previousAnswer = null) {
  try {
    const response = await fetch(`${API_BASE}/socratic`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        topic: topic,
        previous_answer: previousAnswer,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      const errorMsg = errorData?.detail || `Server error: ${response.status} ${response.statusText}`;
      throw new Error(errorMsg);
    }

    return await response.json();
  } catch (err) {
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      throw new Error('Cannot connect to backend. Is it running on localhost:8000?');
    }
    throw err;
  }
}

// Speech synthesis using browser API
export function speakText(text) {
  if ('speechSynthesis' in window) {
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 0.8;
    
    // Try to get a British voice
    const voices = window.speechSynthesis.getVoices();
    const britishVoice = voices.find(v => 
      v.lang.includes('en-GB') || v.name.includes('British')
    );
    if (britishVoice) {
      utterance.voice = britishVoice;
    }
    
    window.speechSynthesis.speak(utterance);
    return utterance;
  }
  console.log('Speech synthesis not supported');
  return null;
}

// Stop any ongoing speech
export function stopSpeech() {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

// Generate mock profile data from analysis
export function generateProfile(analysis) {
  return {
    year: 'Year 2',
    targetRole: analysis?.experience_level || 'Graduate Software Engineer',
    location: 'London, UK',
    matchScore: calculateMatchScore(analysis),
  };
}

// Calculate match score from analysis
function calculateMatchScore(analysis) {
  if (!analysis) return 0;
  
  const userSkills = ['Python', 'JavaScript', 'Problem-solving', 'Communication'];
  const allSkills = [
    ...(analysis.technical_skills || []),
    ...(analysis.tools_technologies || []),
    ...(analysis.cognitive_skills || []),
    ...(analysis.behavioural_traits || []),
  ];
  
  if (allSkills.length === 0) return 75;
  
  const matched = allSkills.filter(skill =>
    userSkills.some(us => 
      us.toLowerCase().includes(skill.toLowerCase()) ||
      skill.toLowerCase().includes(us.toLowerCase())
    )
  );
  
  return Math.min(95, Math.max(45, Math.round((matched.length / allSkills.length) * 100) + 20));
}

// Generate priorities from analysis
export function generatePriorities(analysis) {
  if (!analysis) return [];
  
  const priorities = [];
  
  // Priority based on technical skills gap
  if (analysis.technical_skills?.length > 0) {
    priorities.push({
      id: 1,
      action: `Deep dive: ${analysis.technical_skills[0]}`,
      reason: 'Core technical requirement for your target role. Immediate attention needed.',
      urgency: 'high'
    });
  }
  
  // Priority based on tools
  if (analysis.tools_technologies?.length > 0) {
    priorities.push({
      id: 2,
      action: `Build project with ${analysis.tools_technologies[0]}`,
      reason: 'Practical experience with industry tools demonstrates job readiness.',
      urgency: 'medium'
    });
  }
  
  // Priority based on cognitive skills
  if (analysis.cognitive_skills?.length > 0) {
    priorities.push({
      id: 3,
      action: `Practice ${analysis.cognitive_skills[0]} exercises`,
      reason: 'Cognitive skills are tested heavily in technical interviews.',
      urgency: 'medium'
    });
  }
  
  return priorities.slice(0, 3);
}

// Mock data generator for demo mode
function generateMockAnalysis() {
  return {
    technical_skills: ['Python', 'JavaScript', 'React'],
    tools_technologies: ['Git', 'Docker', 'PostgreSQL'],
    cognitive_skills: ['Problem-solving', 'System Design', 'Critical Thinking'],
    behavioural_traits: ['Communication', 'Teamwork', 'Leadership'],
    experience_level: 'Graduate / Entry-level',
    isMock: true
  };
}

// Fallback API call with automatic mock mode
export async function analyzeCareerWithFallback(jobText) {
  try {
    return await analyzeCareer(jobText);
  } catch (err) {
    console.warn('Backend unavailable, using mock data:', err.message);
    return generateMockAnalysis();
  }
}
