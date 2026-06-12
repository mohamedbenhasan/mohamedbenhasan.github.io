import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import http from "http";
import net from "net";
import { WebSocketServer, WebSocket } from "ws";
import cors from "cors";

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
  
  app.use(cors());
  app.use(express.json());

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });

  // Map of connected UI clients to their active TCP sockets
  const tcpConnections = new Map<WebSocket, net.Socket>();

  wss.on("connection", (ws) => {
    ws.on("message", (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        if (data.type === "connect_teria") {
          const { host, port } = data.payload;
          
          if (tcpConnections.has(ws)) {
            const existingSocket = tcpConnections.get(ws);
            existingSocket?.destroy();
            tcpConnections.delete(ws);
          }

          const tcpSocket = new net.Socket();
          tcpConnections.set(ws, tcpSocket);
          
          tcpSocket.connect(port, host, () => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "teria_status", status: "connected" }));
            }
          });

          let dataBuffer = "";

          tcpSocket.on("data", (data) => {
            dataBuffer += data.toString();
            let newlineIdx;
            while ((newlineIdx = dataBuffer.indexOf('\n')) !== -1) {
              const line = dataBuffer.substring(0, newlineIdx).trim();
              dataBuffer = dataBuffer.substring(newlineIdx + 1);
              if (line && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: "teria_data", payload: line }));
              }
            }
          });

          tcpSocket.on("error", (err) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "teria_error", error: err.message }));
            }
          });

          tcpSocket.on("close", () => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "teria_status", status: "disconnected" }));
            }
            tcpConnections.delete(ws);
          });
        }
        
        if (data.type === "disconnect_teria") {
          const socket = tcpConnections.get(ws);
          if (socket) {
            socket.destroy();
            tcpConnections.delete(ws);
          }
          ws.send(JSON.stringify({ type: "teria_status", status: "disconnected" }));
        }
      } catch (err) {
        console.error("WS Message Error", err);
      }
    });

    ws.on("close", () => {
      const socket = tcpConnections.get(ws);
      if (socket) {
        socket.destroy();
        tcpConnections.delete(ws);
      }
    });
  });

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
