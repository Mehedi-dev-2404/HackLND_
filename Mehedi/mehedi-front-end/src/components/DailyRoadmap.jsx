// DailyRoadmap - Daily timeline from Mohammed code.html
// Shows scheduled tasks with status: Active, Upcoming, Scheduled

export default function DailyRoadmap({ tasks, onTaskClick }) {
  const defaultTasks = [
    { id: 1, title: 'SQL Practice', status: 'active', time: 'Now' },
    { id: 2, title: 'Apply Goldman', status: 'upcoming', time: '10:30' },
    { id: 3, title: 'Socratic Session', status: 'scheduled', time: '13:00' }
  ];

  const items = tasks?.length ? tasks : defaultTasks;

  const getStatusStyle = (status) => {
    switch (status) {
      case 'active':
        return {
          border: 'border-white',
          bg: 'bg-white/10',
          text: 'text-white',
          label: 'NOW ACTIVE'
        };
      case 'upcoming':
        return {
          border: 'border-yellow-500',
          bg: 'bg-yellow-500/10',
          text: 'text-yellow-500',
          label: 'UPCOMING'
        };
      case 'scheduled':
        return {
          border: 'border-gray-500',
          bg: 'bg-gray-500/10',
          text: 'text-gray-500',
          label: 'SCHEDULED'
        };
      default:
        return {
          border: 'border-gray-700',
          bg: 'bg-transparent',
          text: 'text-gray-500',
          label: ''
        };
    }
  };

  return (
    <section className="animate-fade-in mb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="text-gray-500 text-xs tracking-wider">// daily_roadmap</div>
        <button className="text-xs text-gray-500 hover:text-white transition-colors">
          view all →
        </button>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Horizontal line */}
        <div className="absolute top-5 left-0 right-0 h-px bg-gray-800 hidden md:block" />

        {/* Tasks */}
        <div className="flex flex-col md:flex-row justify-between gap-4 md:gap-0">
          {items.map((task) => {
            const style = getStatusStyle(task.status);
            return (
              <button
                key={task.id}
                onClick={() => onTaskClick?.(task)}
                className={`flex items-center md:flex-col gap-4 md:gap-2 p-4 md:p-0 
                           border md:border-0 ${style.border} md:border-transparent
                           hover:bg-gray-900/50 md:hover:bg-transparent transition-all
                           text-left md:text-center group`}
              >
                {/* Icon circle with rotating ring for active */}
                <div className={`relative w-10 h-10 flex items-center justify-center
                                group-hover:scale-110 transition-transform`}>
                  {task.status === 'active' && (
                    <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-white animate-spin-slow" />
                  )}
                  <div className={`w-10 h-10 rounded-full ${style.border} ${style.bg} 
                                  border flex items-center justify-center`}>
                    <span className={style.text}>●</span>
                  </div>
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 
                                  bg-gray-900 border border-gray-700 text-xs text-gray-400 
                                  whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity 
                                  pointer-events-none z-10">
                    {task.title} • {task.time}
                  </div>
                </div>
                
                {/* Text */}
                <div>
                  <p className="font-bold text-white">{task.title}</p>
                  <p className={`text-xs ${style.text} tracking-wider`}>
                    {task.time} {style.label}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
