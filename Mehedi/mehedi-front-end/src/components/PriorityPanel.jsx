export default function PriorityPanel({ priorities = [] }) {
  if (!priorities.length) return null;

  return (
    <section className="animate-fade-in">
      <div className="border border-gray-800 p-6">
        <div className="text-gray-500 text-xs mb-4">// priority_engine</div>
        
        <h3 className="text-lg mb-6">Top 3 Actions Today</h3>

        <div className="space-y-4">
          {priorities.map((priority, index) => (
            <div 
              key={index}
              className="p-4 border border-gray-800 hover:border-gray-600 transition-colors"
            >
              <div className="flex items-start gap-4">
                <div className="text-2xl font-bold text-gray-600 w-8">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="text-white mb-2">{priority.action}</div>
                  <div className="text-gray-500 text-sm">
                    {priority.reason}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
