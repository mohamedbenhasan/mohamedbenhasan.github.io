import React, { useState } from 'react';
import { VRU, RiskScoreConfig, RiskLevel, RiskCalculationModel } from '../types';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface RiskScorePanelProps {
  vru: VRU;
  config: RiskScoreConfig;
  onConfigChange: (config: RiskScoreConfig) => void;
  isOpen: boolean;
  onToggle: () => void;
  onOptimize: () => void;
  isOptimizing: boolean;
}

export const RiskScorePanel: React.FC<RiskScorePanelProps> = ({ vru, config, onConfigChange, isOpen, onToggle, onOptimize, isOptimizing }) => {
  const [localConfig, setLocalConfig] = useState<RiskScoreConfig>(config);
  const [showExplanation, setShowExplanation] = useState(false);

  // Sync local config when prop changes (e.g. after optimization)
  React.useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  const handleConfigChange = (key: keyof RiskScoreConfig, value: any) => {
    const newConfig = { ...localConfig, [key]: value };
    setLocalConfig(newConfig);
    onConfigChange(newConfig);
  };

  const getRiskColor = (level: RiskLevel) => {
    switch (level) {
      case RiskLevel.CRITICAL: return 'text-red-500';
      case RiskLevel.HIGH: return 'text-orange-500';
      case RiskLevel.WARNING: return 'text-yellow-500';
      case RiskLevel.LOW: return 'text-green-500';
      default: return 'text-slate-400';
    }
  };

  const getRiskBg = (level: RiskLevel) => {
    switch (level) {
      case RiskLevel.CRITICAL: return 'bg-red-500/20 border-red-500/50';
      case RiskLevel.HIGH: return 'bg-orange-500/20 border-orange-500/50';
      case RiskLevel.WARNING: return 'bg-yellow-500/20 border-yellow-500/50';
      case RiskLevel.LOW: return 'bg-green-500/20 border-green-500/50';
      default: return 'bg-slate-800 border-slate-700';
    }
  };

  if (!isOpen) {
    return (
      <button 
        onClick={onToggle}
        className="fixed bottom-6 right-6 z-40 bg-slate-900 border border-slate-700 text-white p-4 rounded-full shadow-xl hover:bg-slate-800 transition-all flex items-center gap-2"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
        <span className="font-bold">RISK MODEL</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-40 w-96 bg-slate-900/95 backdrop-blur border border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
      <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
        <h3 className="font-bold text-white flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
          {showExplanation ? 'RISK FACTOR ANALYSIS (XAI)' : 'MULTI-PARAMETER RISK MODEL'}
        </h3>
        <button onClick={onToggle} className="text-slate-400 hover:text-white">✕</button>
      </div>

      <div className="p-4 overflow-y-auto custom-scrollbar space-y-6 flex-1">
        
        {showExplanation && vru.riskScore?.explanation ? (
          <div className="space-y-6 animate-in fade-in slide-in-from-right duration-300">
            {/* Recommendation */}
            <div className="bg-blue-900/20 border border-blue-500/30 p-4 rounded-lg">
              <div className="text-xs font-bold text-blue-400 uppercase mb-1 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                AI Recommendation
              </div>
              <div className="text-white font-medium text-sm leading-relaxed">
                "{vru.riskScore.explanation.recommendation}"
              </div>
            </div>

            {/* Factor Breakdown */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-400 uppercase border-b border-slate-800 pb-2">Contribution Breakdown</h4>
              {Object.entries(vru.riskScore.explanation.contributions).map(([key, value]) => {
                const percentage = value as number;
                let barColor = 'bg-slate-600';
                if (percentage > 40) barColor = 'bg-red-500';
                else if (percentage > 20) barColor = 'bg-yellow-500';
                else if (percentage > 10) barColor = 'bg-blue-500';

                return (
                  <div key={key} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                      <span className="font-mono text-slate-400">{percentage.toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${barColor}`} 
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Formula */}
            <div className="bg-slate-950 p-3 rounded border border-slate-800 font-mono text-[10px] text-slate-500 break-all">
              <div className="font-bold text-slate-400 mb-1">MATHEMATICAL MODEL:</div>
              {vru.riskScore.explanation.formula}
            </div>

            <button 
              onClick={() => setShowExplanation(false)}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 rounded text-xs font-bold text-white transition-colors"
            >
              BACK TO CONFIGURATION
            </button>
          </div>
        ) : (
          <>
            {/* Score Display */}
            <div className={`p-4 rounded-lg border flex items-center justify-between ${getRiskBg(vru.riskScore?.level || RiskLevel.LOW)}`}>
              <div>
                <div className="text-xs font-bold opacity-75 uppercase tracking-wider">Current Risk Score</div>
                <div className="text-4xl font-black tracking-tighter mt-1">
                  {vru.riskScore?.value.toFixed(0) || 0}
                  <span className="text-lg font-normal opacity-50 ml-1">/100</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <div className={`px-3 py-1 rounded font-bold text-sm uppercase bg-black/20 ${getRiskColor(vru.riskScore?.level || RiskLevel.LOW)}`}>
                  {vru.riskScore?.level || 'LOW'}
                </div>
                {vru.riskScore && (
                  <div className="text-[10px] font-mono opacity-75 flex items-center gap-1">
                    CONF: <span className={`${vru.riskScore.confidence > 0.8 ? 'text-green-400' : vru.riskScore.confidence > 0.5 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {(vru.riskScore.confidence * 100).toFixed(0)}%
                    </span>
                    <span className="mx-1">|</span>
                    INT: <span className={`${vru.riskScore.integrity === 'HIGH' ? 'text-green-400' : vru.riskScore.integrity === 'MEDIUM' ? 'text-yellow-400' : 'text-red-400'}`}>
                      {vru.riskScore.integrity}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Live Graph */}
            <div className="h-40 w-full bg-slate-950/50 rounded-lg border border-slate-800 p-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={vru.riskScore?.history || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                  <XAxis dataKey="timestamp" hide />
                  <YAxis domain={[0, 100]} hide />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f1f5f9' }}
                    itemStyle={{ color: '#f1f5f9' }}
                    labelFormatter={() => ''}
                    formatter={(value: any) => [Number(value).toFixed(1), 'Score']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#3b82f6" 
                    strokeWidth={2} 
                    dot={false} 
                    isAnimationActive={false} 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Explain Button */}
            <button 
              onClick={() => setShowExplanation(true)}
              className="w-full py-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/50 text-blue-400 rounded text-xs font-bold flex items-center justify-center gap-2 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              EXPLAIN RISK FACTORS (XAI)
            </button>

            {/* Weight Configuration */}
            <div className="space-y-4">
              
              {/* Model Selection */}
              <div className="border-b border-slate-800 pb-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Calculation Model</h4>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleConfigChange('model', RiskCalculationModel.ADDITIVE)}
                    className={`flex-1 py-2 px-1 rounded text-[10px] font-bold border transition-all ${
                      localConfig.model === RiskCalculationModel.ADDITIVE 
                        ? 'bg-blue-600/20 border-blue-500 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.3)]' 
                        : 'bg-slate-800 border-slate-700 text-slate-500 hover:bg-slate-700 hover:text-slate-300'
                    }`}
                  >
                    ADDITIVE (SIMPLE)
                    <div className="font-mono text-[9px] opacity-70 mt-0.5">R = Σ(wi * Si)</div>
                  </button>
                  <button
                    onClick={() => handleConfigChange('model', RiskCalculationModel.MULTIPLICATIVE)}
                    className={`flex-1 py-2 px-1 rounded text-[10px] font-bold border transition-all ${
                      localConfig.model === RiskCalculationModel.MULTIPLICATIVE 
                        ? 'bg-purple-600/20 border-purple-500 text-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.3)]' 
                        : 'bg-slate-800 border-slate-700 text-slate-500 hover:bg-slate-700 hover:text-slate-300'
                    }`}
                  >
                    MULTIPLICATIVE (ADVANCED)
                    <div className="font-mono text-[9px] opacity-70 mt-0.5">R = Danger × Exposure</div>
                  </button>
                </div>
              </div>

              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase">Weight Configuration</h4>
                <button 
                  onClick={onOptimize}
                  disabled={isOptimizing}
                  className="text-[10px] bg-purple-600/20 text-purple-400 hover:bg-purple-600/40 border border-purple-500/30 px-2 py-1 rounded flex items-center gap-1 transition-colors disabled:opacity-50"
                >
                  {isOptimizing ? (
                    <>
                      <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      TUNING...
                    </>
                  ) : (
                    <>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      AI AUTO-TUNE
                    </>
                  )}
                </button>
              </div>
              
              {Object.entries(localConfig).filter(([key]) => key.startsWith('w')).map(([key, value]) => (
                <div key={key} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300 capitalize">{key.replace('w', '').replace('_', '. ').replace(/([A-Z])/g, ' $1').trim()}</span>
                    <span className="font-mono text-blue-400">{value}</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={value as number} 
                    onChange={(e) => handleConfigChange(key as keyof RiskScoreConfig, parseInt(e.target.value))}
                    className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>
              ))}

              <h4 className="text-xs font-bold text-slate-400 uppercase border-b border-slate-800 pb-2 mt-6">Model Parameters</h4>
              
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300 capitalize">Density Radius (m)</span>
                  <span className="font-mono text-purple-400">{localConfig.densityRadius}m</span>
                </div>
                <input 
                  type="range" 
                  min="10" 
                  max="200" 
                  step="10"
                  value={localConfig.densityRadius} 
                  onChange={(e) => handleConfigChange('densityRadius', parseInt(e.target.value))}
                  className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
