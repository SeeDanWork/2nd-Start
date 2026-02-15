import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

interface SocketState {
  socket: Socket | null;
  connected: boolean;
  lastEvent: { type: string; data: any } | null;
  connect: (token: string) => void;
  disconnect: () => void;
  joinFamily: (familyId: string) => void;
  leaveFamily: (familyId: string) => void;
}

export const useSocketStore = create<SocketState>((set, get) => ({
  socket: null,
  connected: false,
  lastEvent: null,

  connect: (token: string) => {
    const existing = get().socket;
    if (existing?.connected) return;

    const socket = io(`${API_BASE_URL}/ws`, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });

    socket.on('connect', () => {
      set({ connected: true });
    });

    socket.on('disconnect', () => {
      set({ connected: false });
    });

    // Listen for family events
    const events = [
      'schedule_updated',
      'proposal_received',
      'proposal_accepted',
      'proposal_expired',
      'emergency_changed',
    ];

    for (const event of events) {
      socket.on(event, (data: any) => {
        set({ lastEvent: { type: event, data } });
      });
    }

    set({ socket });
  },

  disconnect: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set({ socket: null, connected: false });
    }
  },

  joinFamily: (familyId: string) => {
    const { socket } = get();
    if (socket?.connected) {
      socket.emit('join_family', familyId);
    }
  },

  leaveFamily: (familyId: string) => {
    const { socket } = get();
    if (socket?.connected) {
      socket.emit('leave_family', familyId);
    }
  },
}));
