import React, { useState, useEffect } from 'react';
import { Dashboard } from './components/Dashboard';
import { HistoryPage } from './components/HistoryPage';
import { UserProfile } from './components/UserProfile';
import { Login } from './components/Login';
import { useAuth } from './AuthContext';
import { User } from './types';
import { simulationService } from './services/SimulationService';
import { Toaster } from 'sonner';

enum View {
  LANDING = 'LANDING',
  LOGIN = 'LOGIN',
  APP = 'APP',
  HISTORY = 'HISTORY',
  PROFILE = 'PROFILE'
}

const App: React.FC = () => {
  const [view, setView] = useState<View>(View.LANDING);
  const { user, role, loading, logout } = useAuth();

  useEffect(() => {
    // If user logs in while on login screen, go to app
    if (user && view === View.LOGIN) {
      setView(View.APP);
    }
    // If user logs out while in app, go to landing
    if (!user && (view === View.APP || view === View.HISTORY || view === View.PROFILE)) {
      setView(View.LANDING);
    }
    
    // Set user ID for simulation service syncing
    simulationService.setUserId(user ? user.uid : null);
  }, [user, view]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-blue-500 flex flex-col items-center gap-4">
          <svg className="animate-spin h-8 w-8" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-sm font-mono tracking-widest uppercase">Initializing System...</span>
        </div>
      </div>
    );
  }

  // Create a mock user object to pass to components that still expect the old User type
  const mockUser: User = user ? {
    id: user.uid,
    name: user.displayName || user.email?.split('@')[0] || 'User',
    email: user.email || '',
    organization: 'VRU-Guard User',
    role: role || 'OPERATOR'
  } : {
    id: '', name: '', email: '', organization: '', role: 'OPERATOR'
  };

  const handleLogout = async () => {
    await logout();
    setView(View.LANDING);
  };

  const handleLaunch = () => {
    if (user) {
      setView(View.APP);
    } else {
      setView(View.LOGIN);
    }
  };

  if (view === View.LOGIN && !user) {
    return <Login />;
  }

  if (view === View.APP && user) {
    return <Dashboard 
      user={mockUser} 
      onLogout={handleLogout} 
      onViewHistory={() => setView(View.HISTORY)}
      onViewProfile={() => setView(View.PROFILE)}
    />;
  }

  if (view === View.HISTORY && user) {
    return <HistoryPage 
      user={mockUser} 
      onBack={() => setView(View.APP)} 
    />;
  }

  if (view === View.PROFILE && user) {
    return <UserProfile 
      user={mockUser} 
      onBack={() => setView(View.APP)} 
    />;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 relative overflow-hidden">
      <Toaster theme="dark" position="top-center" />
      {/* Background Gradients */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/10 rounded-full blur-[100px]" />
      </div>

      <div className="z-10 max-w-4xl w-full px-6 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs font-mono text-slate-400 mb-8">
           <span className="w-2 h-2 bg-green-500 rounded-full" />
           SYSTEM OPERATIONAL
        </div>
        
        <h1 className="text-6xl md:text-8xl font-bold tracking-tighter text-white mb-6">
          VRU<span className="text-blue-500">GUARD</span>
        </h1>
        
        <p className="text-xl text-slate-400 mb-12 max-w-2xl mx-auto leading-relaxed">
          The first collision-risk management platform powered by hybrid 
          <span className="text-purple-400 mx-1 font-semibold">Quantum-Classical</span> 
          sensor fusion.
        </p>

        <div className="flex flex-col md:flex-row gap-4 justify-center items-center">
          <button 
            onClick={handleLaunch}
            className="group relative px-8 py-4 bg-white text-slate-950 font-bold rounded-lg text-lg hover:bg-slate-200 transition-all flex items-center gap-2"
          >
            {user ? 'Enter Dashboard' : 'Launch Platform'}
            <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
          </button>
          
          {user && (
            <button 
              onClick={() => setView(View.HISTORY)}
              className="px-8 py-4 bg-slate-900 text-white border border-slate-800 font-medium rounded-lg text-lg hover:bg-slate-800 transition-all flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              View History
            </button>
          )}
        </div>

        {user && (
          <div className="mt-8 text-sm text-slate-400">
            Logged in as <span className="text-blue-400 font-bold">{mockUser.name}</span> ({mockUser.organization})
          </div>
        )}

        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
           <div className="p-6 rounded-xl bg-slate-900/50 border border-slate-800">
             <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center mb-4 text-blue-500">
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0121 18.382V7.618a1 1 0 01-.553-.894L15 7m0 13V7m0 0L9 4" /></svg>
             </div>
             <h3 className="text-lg font-bold text-white mb-2">Precise Geolocation</h3>
             <p className="text-sm text-slate-400">PostGIS-backed spatial indexing with dynamic hexagonal zoning.</p>
           </div>
           <div className="p-6 rounded-xl bg-slate-900/50 border border-slate-800">
             <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center mb-4 text-purple-500">
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
             </div>
             <h3 className="text-lg font-bold text-white mb-2">Quantum Fusion</h3>
             <p className="text-sm text-slate-400">Hybrid algorithms reduce RMSE by 40% when sensor sources &gt; 3.</p>
           </div>
           <div className="p-6 rounded-xl bg-slate-900/50 border border-slate-800">
             <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center mb-4 text-green-500">
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
             </div>
             <h3 className="text-lg font-bold text-white mb-2">AI Safety Advisor</h3>
             <p className="text-sm text-slate-400">Gemini-powered recommendations for real-time risk mitigation.</p>
           </div>
        </div>
      </div>
    </div>
  );
};

export default App;