import React, { useState, useEffect, useRef } from 'react';
import { Network, Activity, Zap, HardDrive, ZapOff, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Capacitor } from '@capacitor/core';
import { TcpClient } from '../services/TcpClientPlugin';

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
  const [host, setHost] = useState('172.20.10.2');
  const [port, setPort] = useState('8080');
  const [proxyUrl, setProxyUrl] = useState('');
  const [connectionMethod, setConnectionMethod] = useState<'tcp' | 'python' | 'direct_ws'>('tcp');
  const ws = useRef<WebSocket | null>(null);
  const pollInterval = useRef<number | null>(null);

  useEffect(() => {
    // Initialize proxyUrl with the current window host by default
    if (!proxyUrl) {
      setProxyUrl(`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`);
    }
  }, []);

  const testConnection = async () => {
    if (connectionMethod === 'python') {
      try {
        const res = await fetch(`http://${host}:${port}/gps_data`);
        if (res.ok) {
          toast.success("Test: Serveur Python joignable");
        } else {
          toast.error("Test: Erreur Serveur Python");
        }
      } catch (err: any) {
        toast.error(`Test: Impossible de joindre le serveur (${err.message})`);
      }
      return;
    }

    if (connectionMethod === 'direct_ws') {
      const testWs = new WebSocket(`ws://${host}:${port}`);
      testWs.onopen = () => {
        toast.success("Test: Connexion WebSocket Directe réussie");
        testWs.close();
      };
      testWs.onerror = () => {
        toast.error("Test: Erreur WebSocket Directe (Vérifiez l'URL, ou blockage Mixed Content)");
      };
      return;
    }

    // TCP test
    if (Capacitor.isNativePlatform()) {
      try {
        const result = await TcpClient.connect({ host, port: parseInt(port) });
        if (result.connected) {
          toast.success("Test: Connexion TCP (Native) réussie");
          setTimeout(() => { TcpClient.disconnect(); }, 2000);
        }
      } catch (err: any) {
        toast.error(`Test: Erreur de connexion TCP (Native): ${err.message || err}`);
      }
      return;
    }

    const testWs = new WebSocket(proxyUrl);
    
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
    // Teardown
    if (!teriaState.active) {
      if (ws.current) {
         if (ws.current.readyState === WebSocket.OPEN) {
             try { ws.current.send(JSON.stringify({ type: 'disconnect_teria' })); } catch (e) {}
         }
         const oldWs = ws.current;
         ws.current = null;
         setTimeout(() => {
           try { oldWs?.close(); } catch (e) {}
         }, 100);
      }
      if (pollInterval.current) {
         window.clearInterval(pollInterval.current);
         pollInterval.current = null;
      }
      setTeriaState(prev => {
        if (!prev.connected && prev.fixQuality === null) return prev;
        return { ...prev, connected: false, fixQuality: null };
      });
      return;
    }

    if (connectionMethod === 'python') {
       // Python Polling Mode
       setTeriaState(prev => ({ ...prev, connected: true, fixQuality: 'Python Bridge' }));
       toast.success("Connexion au bridge Python activée");

       pollInterval.current = window.setInterval(async () => {
          try {
             const res = await fetch(`http://${host}:${port}/gps_data`);
             if (res.ok) {
                const data = await res.json();
                if (data.latitude && data.longitude) {
                   onPositionReceived(data.latitude, data.longitude, data.elevation !== null ? data.elevation : undefined);
                   setTeriaState(prev => ({
                     ...prev,
                     lastUpdate: Date.now(),
                     connected: true
                   }));
                   setLastMessage(JSON.stringify(data));
                }
             }
          } catch (e) {
             setTeriaState(prev => ({ ...prev, connected: false }));
          }
       }, 1000);

       return () => {
         if (pollInterval.current) {
            window.clearInterval(pollInterval.current);
            pollInterval.current = null;
         }
       };
    }

    // TCP / WebSocket Proxy Mode
    if (Capacitor.isNativePlatform()) {
      let isReconnecting = false;
      const connectNative = async () => {
         try {
           const res = await TcpClient.connect({ host, port: parseInt(port) });
           if (res.connected) {
              setTeriaState(prev => ({ ...prev, connected: true }));
              toast.success("TCP mode coopératif connecté (Native)");
           }
         } catch (e: any) {
           toast.error(`Erreur mode coopératif: ${e.message || e}`);
           setTeriaState(prev => ({ ...prev, connected: false }));
           if (teriaState.active && !isReconnecting) {
              isReconnecting = true;
              setTimeout(() => { isReconnecting = false; connectNative(); }, 5000);
           }
         }
      };

      const errorHandler = TcpClient.addListener('error', (info: any) => {
         toast.error(`Erreur TCP: ${info.error}`);
         setTeriaState(prev => ({ ...prev, connected: false }));
      });

      const dataHandler = TcpClient.addListener('data', (info: any) => {
         setLastMessage(info.data.substring(0, 100));
         parseNMEA(info.data);
      });

      const disconnectHandler = TcpClient.addListener('disconnected', () => {
         setTeriaState(prev => ({ ...prev, connected: false }));
         if (teriaState.active && !isReconnecting) {
            isReconnecting = true;
            setTimeout(() => { isReconnecting = false; connectNative(); }, 5000);
         }
      });

      connectNative();

      return () => {
        TcpClient.disconnect();
        errorHandler.then(h => h.remove());
        dataHandler.then(h => h.remove());
        disconnectHandler.then(h => h.remove());
      };
    } else if (connectionMethod === 'direct_ws') {
      const connectDirectWS = () => {
        const socket = new WebSocket(`ws://${host}:${port}`);
        socket.onopen = () => {
          setTeriaState(prev => ({ ...prev, connected: true }));
          toast.success("WebSocket Direct connecté");
        };
        socket.onmessage = async (event) => {
          try {
            let dataStr = typeof event.data === 'string' ? event.data : await event.data.text();
            setLastMessage(dataStr.substring(0, 100));
            parseNMEA(dataStr);
          } catch (e) {
            console.error("Direct WS Error parsing", e);
          }
        };
        socket.onerror = (e) => {
          console.error("Direct WS Error", e);
        };
        socket.onclose = () => {
          setTeriaState(prev => ({ ...prev, connected: false }));
          if (teriaState.active) {
            setTimeout(connectDirectWS, 5000);
          }
        };
        ws.current = socket;
      };
      connectDirectWS();
      return () => {
        if (ws.current) ws.current.close();
      };
    } else {
      // WebSocket Proxy Mode (Web)
      const connectWS = () => {
        // Connect to the proxy URL
        if (!proxyUrl) return; // Wait until initialized
        const socket = new WebSocket(proxyUrl);

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
                 toast.success("TCP mode coopératif connecté");
               } else {
                 toast.error("TCP mode coopératif déconnecté");
               }
            }
            if (data.type === 'teria_error') {
               toast.error(`Erreur mode coopératif: ${data.error}`);
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
    }
  }, [teriaState.active, host, port, connectionMethod, proxyUrl]);

  const parseNMEA = (payload: string) => {
    // Basic NMEA parser for GGA and RMC
    const line = payload.trim();
    const parts = line.split(',');

    if (line.startsWith('$GPGGA') || line.startsWith('$GNGGA')) {
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
    } else if (line.startsWith('$GPRMC') || line.startsWith('$GNRMC')) {
      if (parts.length >= 7 && parts[2] === 'A' && parts[3] && parts[5]) {
        const lat = parseNMEACoord(parts[3], parts[4]);
        const lng = parseNMEACoord(parts[5], parts[6]);
        
        let qualityText = 'Active Fix';
        // Mode indicator is often in field 12, but can vary
        if (parts.length > 12) {
           const mode = parts[12].charAt(0);
           if (mode === 'D') qualityText = 'DGPS (Differential)';
           else if (mode === 'R') qualityText = 'RTK Fixed';
           else if (mode === 'F') qualityText = 'RTK Float';
           else if (mode === 'E') qualityText = 'Estimated';
        }

        setTeriaState(prev => ({
          ...prev,
          lastUpdate: Date.now(),
          fixQuality: (!prev.fixQuality || prev.fixQuality === 'Waiting...' || prev.fixQuality === 'Invalid' || prev.fixQuality === 'Active Fix') ? qualityText : prev.fixQuality
        }));

        onPositionReceived(lat, lng, undefined);
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
    proxyUrl,
    setProxyUrl,
    connectionMethod,
    setConnectionMethod,
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
  proxyUrl: string;
  setProxyUrl: (p: string) => void;
  connectionMethod: 'tcp' | 'python' | 'direct_ws';
  setConnectionMethod: (m: 'tcp' | 'python' | 'direct_ws') => void;
  lastMessage?: string | null;
  testConnection?: () => void;
}> = ({ teriaState, setTeriaState, host, setHost, port, setPort, proxyUrl, setProxyUrl, connectionMethod, setConnectionMethod, lastMessage, testConnection }) => {
  return (
    <div className="px-3 pb-4 pt-1">
      <div className="space-y-4">
        {/* Toggle Mode */}
        <div className="flex items-center justify-between bg-slate-800/50 p-2 rounded border border-slate-700">
           <div className="flex items-center gap-2 text-slate-300 text-xs">
              <Zap className={`w-4 h-4 ${teriaState.active ? 'text-blue-400' : 'text-slate-500'}`} />
              Mode Coopératif
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

        {/* Connection Type Config */}
        <div className="space-y-2">
           <label className="text-[10px] uppercase text-slate-500 font-bold block">Type de Connexion</label>
           <select 
              value={connectionMethod}
              onChange={(e) => setConnectionMethod(e.target.value as 'tcp' | 'python')}
              disabled={teriaState.active}
              className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-xs text-white focus:border-blue-500 focus:outline-none disabled:opacity-50"
           >
              <option value="tcp">Direct TCP (Proxy Node.js)</option>
              <option value="python">Script Python (HTTP Polling)</option>
           </select>
        </div>

        {/* Config Form */}
        <div className="grid grid-cols-2 gap-2">
           <div>
             <label className="text-[10px] uppercase text-slate-500 font-bold">{connectionMethod === 'python' ? 'HTTP Host' : connectionMethod === 'direct_ws' ? 'WS Host (ex: 192.168.1.10)' : 'TCP Host'}</label>
             <input 
               type="text" 
               value={host}
               onChange={(e) => setHost(e.target.value)}
               disabled={teriaState.active}
               className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-xs text-white focus:border-blue-500 focus:outline-none disabled:opacity-50"
             />
           </div>
           <div>
             <label className="text-[10px] uppercase text-slate-500 font-bold">{connectionMethod === 'python' ? 'HTTP Port' : connectionMethod === 'direct_ws' ? 'WS Port (ex: 80)' : 'TCP Port'}</label>
             <input 
               type="text" 
               value={port}
               onChange={(e) => setPort(e.target.value)}
               disabled={teriaState.active}
               className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-xs text-white focus:border-blue-500 focus:outline-none disabled:opacity-50"
             />
           </div>
        </div>

        {connectionMethod === 'tcp' && (
           <div>
             <label className="text-[10px] uppercase text-slate-500 font-bold">Node.js Proxy WS URL (ex: ws://192.168.1.50:3000)</label>
             <input 
               type="text" 
               value={proxyUrl}
               onChange={(e) => setProxyUrl(e.target.value)}
               disabled={teriaState.active}
               className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-xs text-white focus:border-blue-500 focus:outline-none disabled:opacity-50"
             />
             <p className="text-[9px] text-slate-400 mt-1">Requis sur version mobile pour relier TCP via le réseau local.</p>
           </div>
        )}

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

        {connectionMethod === 'direct_ws' && (
           <div className="bg-blue-900/40 border border-blue-700/50 p-2 rounded flex gap-2 items-start text-blue-200/80 mb-2 mt-2">
             <AlertTriangle className="w-4 h-4 shrink-0 text-blue-500" />
             <p className="text-[10px] leading-tight">
               <strong>Note Sécurité Web:</strong> Si le site est déployé en HTTPS (ex: Cloud) et votre appareil sur le réseau local Wi-Fi en `ws://` HTTP (ex: 192.168.x.x), 
               le navigateur peut bloquer (erreur Mixed Content). Solution : utilisez le site via une adresse locale HTTP (ex: http://ip-ordinateur), 
               soit autorisez les connexions non sécurisées sur votre navigateur, soit utilisez la version Ngrok du site.
             </p>
           </div>
        )}

        {/* Cloud Run restriction warning */}
        {connectionMethod !== 'direct_ws' && (
           <div className="bg-amber-900/40 border border-amber-700/50 p-2 rounded flex gap-2 items-start text-amber-200/80">
             <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
             <p className="text-[10px] leading-tight">
               <strong>Réseau Local Privé:</strong> Si vous hébergez cette application sur le Cloud, le serveur cloud <strong>ne peut pas accéder</strong> à un équipement Coopératif via une adresse IP locale (ex: 192.168.x.x). Pour une connexion locale directe via le même WiFi, vous devez soit utiliser un proxy réseau (comme ngrok) sur votre ordinateur, ou utiliser le mode WebSocket Native Directe.
             </p>
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
