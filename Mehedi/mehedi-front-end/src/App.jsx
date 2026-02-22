import { useState, useEffect } from 'react';
import SocraticPanel from './components/SocraticPanel';
import PriorityPanel from './components/PriorityPanel';
import StatsBar from './components/StatsBar';
import NotificationCard from './components/NotificationCard';
import DailyRoadmap from './components/DailyRoadmap';
import OpportunityCard from './components/OpportunityCard';
import QuickAsk from './components/QuickAsk';
import TerminalLoader from './components/TerminalLoader';
import SystemStatus from './components/SystemStatus';
import { 
  analyzeCareer, 
  getSocraticQuestion, 
  generateProfile, 
  generatePriorities,
  stopSpeech,
  analyzeCareerWithFallback
} from './api';

// App states
const STATES = {
  LANDING: 'landing',
  DASHBOARD: 'dashboard',
  SOCRATIC: 'socratic',
};

export default function App() {
  const [appState, setAppState] = useState(STATES.LANDING);
  const [analysis, setAnalysis] = useState(null);
  const [profile, setProfile] = useState(null);
  const [priorities, setPriorities] = useState([]);
  const [socraticQuestion, setSocraticQuestion] = useState('');
  const [socraticTopic, setSocraticTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [quickAskLoading, setQuickAskLoading] = useState(false);
  const [mockMode, setMockMode] = useState(false);

  // Daily roadmap tasks
  const [dailyTasks] = useState([
    { id: 1, title: 'SQL Practice', status: 'active', time: 'Now' },
    { id: 2, title: 'Apply Goldman', status: 'upcoming', time: '10:30' },
    { id: 3, title: 'Socratic Session', status: 'scheduled', time: '13:00' }
  ]);

  // Opportunities data
  const [opportunities] = useState([
    {
      type: 'job',
      title: 'Morgan Stanley',
      subtitle: 'Technology Analyst Internship',
      badge: 'Summer Internship',
      matchScore: 94,
      actionText: 'Apply Now'
    },
    {
      type: 'funding',
      title: 'DSA Grant',
      subtitle: 'Disabled Students Allowance',
      amount: '£25k',
      available: true,
      actionText: 'Claim Funding'
    }
  ]);

  // Mock job description for demo
  const mockJobDescription = `
    Graduate Software Engineer - London
    We are looking for a motivated graduate to join our engineering team.
    
    Requirements:
    - Strong knowledge of Python and JavaScript
    - Experience with React or similar frameworks
    - Understanding of RESTful APIs
    - Problem-solving abilities
    - Excellent communication skills
    - Team collaboration
    
    Experience Level: Graduate / Entry-level
  `;

  // Handler: START button clicked with fallback to mock mode
  const handleStart = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await analyzeCareerWithFallback(mockJobDescription);
      if (result.isMock) {
        setMockMode(true);
      }
      setAnalysis(result);
      setProfile(generateProfile(result));
      setPriorities(generatePriorities(result));
      setSocraticTopic(result.technical_skills?.[0] || 'software engineering');
      setAppState(STATES.DASHBOARD);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handler: Enter Socratic Mode
  const handleEnterSocratic = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await getSocraticQuestion(socraticTopic, null);
      setSocraticQuestion(result.question);
      setAppState(STATES.SOCRATIC);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handler: Submit Socratic Answer
  const handleSocraticAnswer = async (answer) => {
    setLoading(true);
    setError(null);

    try {
      const result = await getSocraticQuestion(socraticTopic, answer);
      setSocraticQuestion(result.question);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handler: Exit Socratic Mode
  const handleExitSocratic = () => {
    stopSpeech();
    setSocraticQuestion('');
    setAppState(STATES.DASHBOARD);
  };

  // Handler: Back to Landing
  const handleBackToLanding = () => {
    stopSpeech();
    setAppState(STATES.LANDING);
    setAnalysis(null);
    setProfile(null);
    setPriorities([]);
    setSocraticQuestion('');
  };

  // Handler: Quick Ask
  const handleQuickAsk = async (question) => {
    setQuickAskLoading(true);
    try {
      const result = await getSocraticQuestion(question, null);
      setSocraticQuestion(result.question);
      setSocraticTopic(question);
      setAppState(STATES.SOCRATIC);
    } catch (err) {
      setError(err.message);
    } finally {
      setQuickAskLoading(false);
    }
  };

  // Handler: Task click from roadmap
  const handleTaskClick = (task) => {
    if (task.title === 'Socratic Session') {
      handleEnterSocratic();
    }
  };

  // Handler: Notification action
  const handleNotificationAction = () => {
    // Could navigate to priorities or trigger specific action
    console.log('Taking action on notification');
  };

  return (
    <div className="min-h-screen bg-black text-white font-mono flex flex-col">
      {/* STATE 1: LANDING */}
      {appState === STATES.LANDING && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center animate-fade-in">
            <button
              onClick={handleStart}
              disabled={loading}
              className="start-btn px-12 py-4 border border-white text-lg tracking-wider hover:bg-white hover:text-black transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center gap-3">
                  <span className="animate-pulse-subtle">▌</span>
                  <span>initializing...</span>
                </span>
              ) : (
                '[ START ]'
              )}
            </button>
            
            {error && (
              <div className="mt-6 text-red-500 text-sm animate-fade-in">
                ! {error}
              </div>
            )}
          </div>
        </div>
      )}

      {/* STATE 2: DASHBOARD */}
      {appState === STATES.DASHBOARD && (
        <>
          <header className="border-b border-gray-800">
            <div className="max-w-[900px] mx-auto px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl tracking-tight">
                    <span className="text-gray-500">&gt;</span> beacon
                  </h1>
                </div>
                <div className="flex items-center gap-6">
                  <StatsBar />
                  <button
                    onClick={handleBackToLanding}
                    className="text-gray-500 text-sm hover:text-white transition-colors"
                  >
                    [ exit ]
                  </button>
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 max-w-[900px] mx-auto px-6 py-8 w-full">
            {/* Error Display */}
            {error && (
              <div className="mb-6 p-4 border border-red-500 animate-fade-in">
                <span className="text-red-500">! {error}</span>
                <button 
                  onClick={() => setError(null)}
                  className="ml-4 text-gray-500 hover:text-white"
                >
                  dismiss
                </button>
              </div>
            )}

            {/* Priority Notification */}
            <NotificationCard 
              onAction={handleNotificationAction}
            />

            {/* Profile Snapshot */}
            <section className="animate-fade-in mb-8">
              <div className="border border-gray-800 p-6">
                <div className="text-gray-500 text-xs mb-4">// profile_snapshot</div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div>
                    <div className="text-gray-500 text-xs mb-1">year</div>
                    <div className="text-lg">{profile?.year}</div>
                  </div>
                  <div>
                    <div className="text-gray-500 text-xs mb-1">target_role</div>
                    <div className="text-lg">{profile?.targetRole}</div>
                  </div>
                  <div>
                    <div className="text-gray-500 text-xs mb-1">location</div>
                    <div className="text-lg">{profile?.location}</div>
                  </div>
                  <div>
                    <div className="text-gray-500 text-xs mb-1">match_score</div>
                    <div className="text-3xl font-bold">{profile?.matchScore}%</div>
                  </div>
                </div>
              </div>
            </section>

            {/* Daily Roadmap */}
            <DailyRoadmap 
              tasks={dailyTasks} 
              onTaskClick={handleTaskClick}
            />

            {/* Priority Engine */}
            <PriorityPanel priorities={priorities} />

            {/* Opportunities Grid */}
            <section className="animate-fade-in mt-8 mb-8">
              <div className="flex items-center justify-between mb-4">
                <div className="text-gray-500 text-xs tracking-wider">// opportunities</div>
                <button className="text-xs text-gray-500 hover:text-white transition-colors">
                  view all →
                </button>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                {opportunities.map((opp, idx) => (
                  <OpportunityCard 
                    key={idx} 
                    opportunity={opp}
                    onApply={(o) => console.log('Apply:', o)}
                  />
                ))}
              </div>
            </section>

            {/* Quick Ask */}
            <QuickAsk 
              onAsk={handleQuickAsk}
              loading={quickAskLoading}
            />

            {/* Action Buttons */}
            <section className="animate-fade-in mt-8">
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => console.log('Execute priorities')}
                  className="flex-1 py-3 border border-gray-800 text-sm hover:border-white transition-colors"
                >
                  [ Execute Now ]
                </button>
                <button
                  onClick={handleEnterSocratic}
                  disabled={loading}
                  className="flex-1 py-3 border border-white text-sm hover:bg-white hover:text-black transition-all disabled:opacity-50"
                >
                  {loading ? 'loading...' : '[ Enter Socratic Mode ]'}
                </button>
              </div>
            </section>
          </main>
        </>
      )}

      {/* STATE 3: SOCRATIC MODE */}
      {appState === STATES.SOCRATIC && (
        <>
          <header className="border-b border-gray-800">
            <div className="max-w-[900px] mx-auto px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl tracking-tight">
                    <span className="text-gray-500">&gt;</span> socratic_mode
                  </h1>
                </div>
                <button
                  onClick={handleExitSocratic}
                  className="text-gray-500 text-sm hover:text-white transition-colors"
                >
                  [ exit ]
                </button>
              </div>
            </div>
          </header>

          <main className="flex-1 max-w-[900px] mx-auto px-6 py-8 w-full">
            {error && (
              <div className="mb-6 p-4 border border-red-500 animate-fade-in">
                <span className="text-red-500">! {error}</span>
              </div>
            )}

            <SocraticPanel
              question={socraticQuestion}
              loading={loading}
              onSubmitAnswer={handleSocraticAnswer}
              topic={socraticTopic}
            />
          </main>
        </>
      )}

      {/* Footer */}
      <footer className="border-t border-gray-800">
        <div className="max-w-[900px] mx-auto px-6 py-3">
          <div className="flex justify-between text-gray-600 text-xs">
            <span>beacon v1.0</span>
            <span>{mockMode ? 'mock mode' : 'backend: localhost:8000'}</span>
          </div>
        </div>
      </footer>

      {/* System Status Indicator */}
      <SystemStatus />

      {/* Terminal Loader */}
      <TerminalLoader active={loading} />
    </div>
  );
}
