import { Server } from 'socket.io';

let io = null;

export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
    },
  });

  io.on('connection', (socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);

    socket.on('join_device', (deviceId) => {
      socket.join(`device:${deviceId}`);
      console.log(`[Socket.IO] Client ${socket.id} joined room device:${deviceId}`);
    });

    socket.on('leave_device', (deviceId) => {
      socket.leave(`device:${deviceId}`);
    });

    socket.on('disconnect', () => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io has not been initialized yet!');
  }
  return io;
};

export const broadcastTelemetry = (deviceId, telemetry) => {
  if (io) {
    io.emit('telemetry_update', { deviceId, ...telemetry });
    io.to(`device:${deviceId}`).emit('device_telemetry', telemetry);
  }
};

export const broadcastDeviceStatus = (device) => {
  if (io) {
    io.emit('device_status_update', device);
  }
};

export const broadcastCommandStatus = (command) => {
  if (io) {
    io.emit('command_status_update', command);
  }
};
