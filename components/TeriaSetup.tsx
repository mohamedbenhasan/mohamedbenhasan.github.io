import React, { useState, useEffect, useRef } from 'react';
import { Network, Activity, Zap, HardDrive, ZapOff } from 'lucide-react';
import { toast } from 'sonner';

interface TeriaStatus {
  connected: boolean;
  lastUpdate: number | null;
  fixQuality: string | null;
  active: boolean; // whether TERIA mode is toggled ON
}

export const useTeria = (onPositionReceived: (lat: number, lng: number, alt?: number) => void) => {
  const [teriaState, setTeriaState] = useState<TeriaStatus>({
    connected: false,
    lastUpdate: null,
    fixQuality: null,
    active: false,
  });
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [host, setHost] = useState('127.0.0.1');
  const [port, setPort] = useState('9000');
  const ws = useRef<WebSocket | null>(null);

  const testConnection = () => {
    // Attempt a short-lived connection just to test
    const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;
    const testWs = new WebSocket(wsUrl);
    
    testWs.onopen = () => {
       testWs.send(JSON.stringify({
         type: 'connect_teria',
         payload: { host, port: parseInt(port) }
       }));
    };

    testWs.onmessage = (event) => {
       try {
         const data = JSON.parse(event.data);
         if (data.type === 'teria_status' && data.status === 'connected') {
           toast.success("Test: Connexion TCP réussie");
         }
         if (data.type === 'teria_error') {
           toast.error(`Test: Erreur de connexion (${data.error})`);
           testWs.close();
         }
         if (data.type === 'teria_data') {
           setLastMessage(data.payload.substring(0, 100)); // Just keep a snippet
           testWs.close();
         }
       } catch(e) {}
    };

    setTimeout(() => {
       if (testWs.readyState === WebSocket.OPEN) {
         testWs.close();
       }
    }, 5000); // close after 5s
  };

  useEffect(() => {
    // Only attempt to connect to WS when active
    if (!teriaState.active) {
      if (ws.current) {
         ws.current.send(JSON.stringify({ type: 'disconnect_teria' }));
         setTimeout(() => {
           ws.current?.close();
           ws.current = null;
         }, 100);
      }
      setTeriaState(prev => ({ ...prev, connected: false, fixQuality: null }));
      return;
    }

    const connectWS = () => {
      // Connect to the same host but port 3000 where our WS proxy is
      const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;
      const socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        socket.send(JSON.stringify({
          type: 'connect_teria',
          payload: { host, port: parseInt(port) }
        }));
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'teria_status') {
             setTeriaState(prev => ({ ...prev, connected: data.status === 'connected' }));
             if (data.status === 'connected') {
               toast.success("TERIA TCP connecté");
             } else {
               toast.error("TERIA TCP déconnecté");
             }
          }
          if (data.type === 'teria_error') {
             toast.error(`Erreur TERIA: ${data.error}`);
             setTeriaState(prev => ({ ...prev, connected: false }));
          }
          if (data.type === 'teria_data') {
             setLastMessage(data.payload.substring(0, 100));
             parseNMEA(data.payload);
          }
        } catch (e) {
          console.error("Failed to parse WS message", e);
        }
      };

      socket.onclose = () => {
        setTeriaState(prev => ({ ...prev, connected: false }));
        // Try reconnecting after 5 seconds if still active
        if (teriaState.active) {
          setTimeout(connectWS, 5000);
        }
      };

      ws.current = socket;
    };

    connectWS();

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [teriaState.active, host, port]);

  const parseNMEA = (payload: string) => {
    // Basic NMEA parser for GGA and RMC
    const lines = payload.split('\\n');
    for (const line of lines) {
      const parts = line.split(',');
      if (parts[0].endsWith('GGA')) {
        // $GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,*47
        if (parts.length >= 10 && parts[2] && parts[4]) {
          const lat = parseNMEACoord(parts[2], parts[3]);
          const lng = parseNMEACoord(parts[4], parts[5]);
          const quality = parts[6]; // 0=invalid, 1=GPS fix, 2=DGPS fix
          const alt = parseFloat(parts[9]);

          let qualityText = 'Fix';
          if (quality === '0') qualityText = 'Invalid';
          else if (quality === '1') qualityText = 'SPS (Standard)';
          else if (quality === '2') qualityText = 'DGPS (Differential)';
          else if (quality === '4') qualityText = 'RTK Fixed';
          else if (quality === '5') qualityText = 'RTK Float';
          
          setTeriaState(prev => ({
            ...prev,
            lastUpdate: Date.now(),
            fixQuality: qualityText
          }));

          // Only accept good quality fixes (1, 2, 4, 5)
          if (['1', '2', '4', '5'].includes(quality)) {
             onPositionReceived(lat, lng, isNaN(alt) ? undefined : alt);
          }
        }
      }
    }
  };

  const parseNMEACoord = (val: string, dir: string) => {
    if (!val) return 0;
    // Format is DDMM.MMMM for lat or DDDMM.MMMM for lng
    const dotIdx = val.indexOf('.');
    const degs = parseInt(val.substring(0, dotIdx - 2), 10);
    const mins = parseFloat(val.substring(dotIdx - 2));
    let decimal = degs + (mins / 60);
    if (dir === 'S' || dir === 'W') decimal = -decimal;
    return decimal;
  };

  return {
    teriaState,
    setTeriaState,
    host,
    setHost,
    port,
    setPort,
    lastMessage,
    testConnection
  };
};

export const TeriaConfigPanel: React.FC<{
  teriaState: TeriaStatus;
  setTeriaState: React.Dispatch<React.SetStateAction<TeriaStatus>>;
  host: string;
  setHost: (h: string) => void;
  port: string;
  setPort: (p: string) => void;
  lastMessage?: string | null;
  testConnection?: () => void;
}> = ({ teriaState, setTeriaState, host, setHost, port, setPort, lastMessage, testConnection }) => {
  return (
    <div className="px-3 pb-4 pt-1">
      <div className="space-y-4">
        {/* Toggle Mode */}
        <div className="flex items-center justify-between bg-slate-800/50 p-2 rounded border border-slate-700">
           <div className="flex items-center gap-2 text-slate-300 text-xs">
              <Zap className={`w-4 h-4 ${teriaState.active ? 'text-blue-400' : 'text-slate-500'}`} />
              Mode TERIA
           </div>
           <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={teriaState.active}
                onChange={(e) => setTeriaState(prev => ({...prev, active: e.target.checked}))}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
           </label>
        </div>

        {/* Config Form */}
        <div className="grid grid-cols-2 gap-2">
           <div>
             <label className="text-[10px] uppercase text-slate-500 font-bold">TCP Host</label>
             <input 
               type="text" 
               value={host}
               onChange={(e) => setHost(e.target.value)}
               disabled={teriaState.active}
               className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-xs text-white focus:border-blue-500 focus:outline-none disabled:opacity-50"
             />
           </div>
           <div>
             <label className="text-[10px] uppercase text-slate-500 font-bold">TCP Port</label>
             <input 
               type="text" 
               value={port}
               onChange={(e) => setPort(e.target.value)}
               disabled={teriaState.active}
               className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-xs text-white focus:border-blue-500 focus:outline-none disabled:opacity-50"
             />
           </div>
        </div>

        <button 
           onClick={testConnection}
           disabled={teriaState.active}
           className="w-full py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-[10px] uppercase text-slate-300 hover:text-white transition-colors flex items-center justify-center disabled:opacity-50"
        >
           Tester connexion
        </button>

        {lastMessage && (
           <div className="bg-slate-950 p-2 rounded border border-slate-800">
             <div className="text-[9px] uppercase text-slate-500 font-bold mb-1">Dernier Message NMEA</div>
             <pre className="text-[10px] text-green-400 font-mono whitespace-pre-wrap break-all leading-tight">{lastMessage}</pre>
           </div>
        )}

        {/* Status Area */}
        {teriaState.active && (
          <div className="border border-slate-700 bg-slate-900 rounded p-3 text-xs space-y-2">
             <div className="flex items-center justify-between">
                <span className="text-slate-400">Statut:</span>
                {teriaState.connected ? (
                  <span className="text-green-400 font-bold flex items-center gap-1"><HardDrive size={12}/> Connecté</span>
                ) : (
                  <span className="text-red-400 font-bold flex items-center gap-1"><ZapOff size={12}/> Déconnecté</span>
                )}
             </div>
             
             {teriaState.connected && (
               <>
                 <div className="flex items-center justify-between">
                    <span className="text-slate-400">Qualité Fix:</span>
                    <span className="text-blue-300 font-mono">{teriaState.fixQuality || 'Waiting...'}</span>
                 </div>
                 <div className="flex items-center justify-between">
                    <span className="text-slate-400">Dernière maj:</span>
                    <span className="text-slate-300 font-mono">
                      {teriaState.lastUpdate ? 
                         ((Date.now() - teriaState.lastUpdate) / 1000).toFixed(1) + 's ago' 
                         : 'N/A'}
                    </span>
                 </div>
               </>
             )}
          </div>
        )}
      </div>
    </div>
  );
};
