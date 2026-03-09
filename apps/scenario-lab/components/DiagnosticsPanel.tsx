'use client';

import { SimulationLog } from '@/lib/types';

interface DiagnosticsPanelProps {
  logs: SimulationLog[];
  bootstrapFacts: Record<string, unknown> | null;
}

const typeColors: Record<string, string> = {
  api_call: 'text-blue-600 bg-blue-50',
  tool_use: 'text-purple-600 bg-purple-50',
  stage_change: 'text-green-600 bg-green-50',
  error: 'text-red-600 bg-red-50',
  info: 'text-lab-600 bg-lab-50',
  disruption: 'text-amber-600 bg-amber-50',
};

export function DiagnosticsPanel({ logs, bootstrapFacts }: DiagnosticsPanelProps) {
  return (
    <div className="space-y-4">
      {/* Bootstrap Facts */}
      {bootstrapFacts && (
        <div>
          <h3 className="text-xs font-semibold text-lab-500 mb-2">Bootstrap Facts</h3>
          <pre className="bg-lab-800 text-green-400 p-3 rounded-lg text-[11px] overflow-auto max-h-60 font-mono">
            {JSON.stringify(bootstrapFacts, null, 2)}
          </pre>
        </div>
      )}

      {/* Event Log */}
      <div>
        <h3 className="text-xs font-semibold text-lab-500 mb-2">
          Event Log ({logs.length})
        </h3>
        <div className="bg-white border border-lab-200 rounded-lg divide-y divide-lab-100 max-h-80 overflow-auto">
          {logs.length === 0 ? (
            <div className="p-3 text-xs text-lab-300 text-center">No events yet</div>
          ) : (
            logs.map(log => (
              <div key={log.id} className="px-3 py-2 flex items-start gap-2">
                <span className={`px-1.5 py-0.5 text-[10px] rounded ${typeColors[log.type] || 'text-lab-500 bg-lab-50'}`}>
                  {log.type}
                </span>
                <span className="text-[10px] text-lab-400 whitespace-nowrap mt-0.5">
                  {log.timestamp.slice(11, 19)}
                </span>
                <span className="text-[10px] text-lab-400 mt-0.5">
                  ...{log.phone.slice(-4)}
                </span>
                <span className="text-xs text-lab-600 flex-1 break-all">
                  {JSON.stringify(log.data).slice(0, 200)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
