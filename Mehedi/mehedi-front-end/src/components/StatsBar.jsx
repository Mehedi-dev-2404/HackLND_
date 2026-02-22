// StatsBar - Quick stats badges with animated counters
import { useCountUp } from '../hooks/useAnimations';

export default function StatsBar({ stats }) {
  const defaultStats = {
    unis: 169,
    jobs: 768,
    fundingNumber: 3400
  };

  const data = stats || defaultStats;
  const unisCount = useCountUp(data.unis, 1000);
  const jobsCount = useCountUp(data.jobs, 1200);
  const fundingCount = useCountUp(data.fundingNumber, 1100);

  return (
    <div className="flex flex-wrap gap-3 animate-fade-in">
      <div className="flex items-center gap-2 px-3 py-1.5 border border-gray-800 text-xs hover:border-gray-600 transition-colors">
        <span className="text-gray-500">◆</span>
        <span className="tracking-wider font-mono">{unisCount} unis</span>
      </div>
      <div className="flex items-center gap-2 px-3 py-1.5 border border-gray-800 text-xs hover:border-gray-600 transition-colors cursor-pointer">
        <span className="text-gray-500">▪</span>
        <span className="tracking-wider font-mono">{jobsCount} jobs</span>
      </div>
      <div className="flex items-center gap-2 px-3 py-1.5 border border-gray-800 text-xs hover:border-gray-600 transition-colors cursor-pointer">
        <span className="text-gray-500">$</span>
        <span className="tracking-wider font-mono">£{fundingCount / 1000}k funding</span>
      </div>
    </div>
  );
}
