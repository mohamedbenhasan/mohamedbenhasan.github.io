import { registerPlugin, PluginListenerHandle } from '@capacitor/core';

export interface TcpClientPlugin {
  connect(options: { host: string; port: number }): Promise<{ connected: boolean }>;
  disconnect(): Promise<void>;
  addListener(eventName: 'connected', listenerFunc: (info: any) => void): Promise<PluginListenerHandle>;
  addListener(eventName: 'error', listenerFunc: (info: any) => void): Promise<PluginListenerHandle>;
  addListener(eventName: 'data', listenerFunc: (info: { data: string }) => void): Promise<PluginListenerHandle>;
  addListener(eventName: 'disconnected', listenerFunc: (info: any) => void): Promise<PluginListenerHandle>;
}

export const TcpClient = registerPlugin<TcpClientPlugin>('TcpClient');
