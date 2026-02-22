// SystemStatus - Backend health indicator top-right
import { useSystemStatus } from '../hooks/useAnimations';

export default function SystemStatus() {
  const status = useSystemStatus();
  const isOnline = status === 'online';

  return (
    <div className="fixed top-4 right-4 z-40">
      <div className={`flex items-center gap-2 px-3 py-1.5 border text-xs font-mono
                      ${isOnline 
                        ? 'border-green-500/30 text-green-500' 
                        : 'border-yellow-500/30 text-yellow-500'}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${
          isOnline ? 'bg-green-500' : 'bg-yellow-500'
        } animate-pulse`} />
        <span>{isOnline ? 'system online' : 'mock mode'}</span>
      </div>
    </div>
  );
}
