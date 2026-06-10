/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Create standard HTTP server to share bindings with WebSocket server
  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  // Use JSON middleware to handle standard API payloads cleanly
  app.use(express.json());

  // Room memory database
  const roomsMap = new Map<string, {
    roomId: string;
    broadcasterName: string;
    broadcasterWs: WebSocket | null;
    viewers: Set<WebSocket>;
    lastActive: string;
  }>();

  // Alert storage database
  const alertsMap = new Map<string, { timestamp: string; image: string }[]>();

  // WebSocket active connection handler
  wss.on("connection", (ws) => {
    let currentRoomId: string | null = null;
    let currentRole: "broadcaster" | "viewer" | null = null;
    let clientName = "Desconocido";

    ws.on("message", (messageStr) => {
      try {
        const payload = JSON.parse(messageStr.toString());

        if (payload.type === "join") {
          const roomId = (payload.roomId || "").toUpperCase().trim();
          const role = payload.role || "viewer";
          const name = payload.name || (role === "broadcaster" ? "Celular Transmisor" : "Consola Operador");

          if (!roomId) return;

          currentRoomId = roomId;
          currentRole = role;
          clientName = name;

          // Initialize room if not exists
          if (!roomsMap.has(roomId)) {
            roomsMap.set(roomId, {
              roomId,
              broadcasterName: role === "broadcaster" ? name : "Cámara en espera",
              broadcasterWs: null,
              viewers: new Set<WebSocket>(),
              lastActive: new Date().toISOString()
            });
          }

          const room = roomsMap.get(roomId)!;
          room.lastActive = new Date().toISOString();

          if (role === "broadcaster") {
            // Drop previous broadcaster if any
            if (room.broadcasterWs && room.broadcasterWs !== ws) {
              try { room.broadcasterWs.close(); } catch (e) {}
            }
            room.broadcasterWs = ws;
            room.broadcasterName = name;
          } else {
            room.viewers.add(ws);
          }

          console.log(`WS: Client "${name}" joined room ${roomId} as ${role}. Total viewers: ${room.viewers.size}`);
          
          // Acknowledge join
          ws.send(JSON.stringify({ type: "joined", roomId, role, viewersCount: room.viewers.size }));
        }

        else if (payload.type === "frame") {
          if (!currentRoomId) return;
          const room = roomsMap.get(currentRoomId);
          if (!room) return;

          room.lastActive = new Date().toISOString();

          // Broadcast frame to all viewers in the same room
          // Protect from buffer overflow to ensure zero-lag OBS fluid gameplay
          const framePayload = JSON.stringify({
            type: "frame",
            image: payload.image,
            timestamp: payload.timestamp || Date.now()
          });

          room.viewers.forEach((viewer) => {
            if (viewer.readyState === WebSocket.OPEN) {
              // Backpressure protection check: skip frame if client is bottlenecking
              if (viewer.bufferedAmount < 500000) {
                viewer.send(framePayload);
              }
            } else {
              room.viewers.delete(viewer);
            }
          });
        }

        else if (payload.type === "alert") {
          if (!currentRoomId) return;
          const timestamp = new Date().toISOString();
          const newAlert = {
            timestamp,
            image: payload.image // base64 JPEG
          };

          // Save to memory
          if (!alertsMap.has(currentRoomId)) {
            alertsMap.set(currentRoomId, []);
          }
          const list = alertsMap.get(currentRoomId)!;
          list.unshift(newAlert);
          if (list.length > 50) list.pop(); // Keep last 50 alerts only to conserve server memory

          // Broadcast alerts to all viewers in that room
          const room = roomsMap.get(currentRoomId);
          if (room) {
            const alertPayload = JSON.stringify({
              type: "alert",
              timestamp,
              image: payload.image
            });
            room.viewers.forEach((viewer) => {
              if (viewer.readyState === WebSocket.OPEN) {
                viewer.send(alertPayload);
              }
            });
          }
        }

        else if (payload.type === "command") {
          // Relay controls or actions between peers
          if (!currentRoomId) return;
          const room = roomsMap.get(currentRoomId);
          if (!room) return;

          console.log(`WS Command relayed in room ${currentRoomId}: ${payload.command}`);

          // Forward to broadcaster
          if (room.broadcasterWs && room.broadcasterWs.readyState === WebSocket.OPEN) {
            room.broadcasterWs.send(JSON.stringify(payload));
          }
          // Also forward command to all viewers (e.g. sync actions)
          room.viewers.forEach((viewer) => {
            if (viewer !== ws && viewer.readyState === WebSocket.OPEN) {
              viewer.send(JSON.stringify(payload));
            }
          });
        }
      } catch (e) {
        console.warn("WS received invalid message or error:", e);
      }
    });

    ws.on("close", () => {
      if (currentRoomId && roomsMap.has(currentRoomId)) {
        const room = roomsMap.get(currentRoomId)!;
        if (currentRole === "broadcaster") {
          if (room.broadcasterWs === ws) {
            room.broadcasterWs = null;
            console.log(`WS: Broadcaster "${clientName}" disconnected from room ${currentRoomId}`);
          }
        } else {
          room.viewers.delete(ws);
          console.log(`WS: Viewer "${clientName}" disconnected from room ${currentRoomId}`);
        }

        // Clean up empty rooms after some delay or keep them for statistical visibility
        if (room.viewers.size === 0 && !room.broadcasterWs) {
          // If completely empty, clean up memory
          roomsMap.delete(currentRoomId);
        }
      }
    });

    ws.on("error", (err) => {
      console.warn("WS socket error:", err);
    });
  });

  // REST API Endpoints

  // GET /api/rooms - List active rooms with basic statistics
  app.get("/api/rooms", (req, res) => {
    const list = Array.from(roomsMap.values()).map(r => ({
      roomId: r.roomId,
      hasBroadcaster: r.broadcasterWs !== null,
      viewersCount: r.viewers.size,
      broadcasterName: r.broadcasterName || "Celular en espera",
      lastActive: r.lastActive
    }));
    res.json({ rooms: list });
  });

  // GET /api/alerts/:roomId - Get last alerts and screenshots for a specific room
  app.get("/api/alerts/:roomId", (req, res) => {
    const roomId = (req.params.roomId || "").toUpperCase().trim();
    const list = alertsMap.get(roomId) || [];
    res.json(list);
  });

  // POST /api/alerts/:roomId - Create a manual or API motion alert via REST if preferred
  app.post("/api/alerts/:roomId", (req, res) => {
    const roomId = (req.params.roomId || "").toUpperCase().trim();
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ error: "Missing base64 image data" });
    }

    const timestamp = new Date().toISOString();
    const alertItem = { timestamp, image };

    if (!alertsMap.has(roomId)) {
      alertsMap.set(roomId, []);
    }
    const list = alertsMap.get(roomId)!;
    list.unshift(alertItem);
    if (list.length > 50) list.pop();

    // Broadcast through WebSocket to viewers
    const room = roomsMap.get(roomId);
    if (room) {
      const alertPayload = JSON.stringify({
        type: "alert",
        timestamp,
        image
      });
      room.viewers.forEach((viewer) => {
        if (viewer.readyState === WebSocket.OPEN) {
          viewer.send(alertPayload);
        }
      });
    }

    res.json({ success: true, timestamp });
  });

  // Keep old endpoints as placeholder options to avoid breaking older component clients until replaced
  app.get("/api/webrtc/status", (req, res) => {
    res.json({ active: false, hasOffer: false, hasAnswer: false });
  });

  // Standard Health Check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // 2. VITE MIDDLEWARE SETUP
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Intercept upgrades and delegate cleanly to wss
  server.on("upgrade", (request, requestSocket, head) => {
    const parsedUrl = new URL(request.url || "", `http://${request.headers.host}`);
    if (parsedUrl.pathname === "/ws") {
      wss.handleUpgrade(request, requestSocket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    } else {
      // Avoid violently destroying sockets in development so that Vite's internal WS can close or negotiate cleanly
      if (process.env.NODE_ENV === "production") {
        requestSocket.destroy();
      }
    }
  });

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Express WebSocket room gateway running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
