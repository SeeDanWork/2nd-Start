import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/ws',
})
export class FamilyGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(FamilyGateway.name);

  @WebSocketServer()
  server!: Server;

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join_family')
  handleJoinFamily(client: Socket, familyId: string) {
    client.join(`family:${familyId}`);
    this.logger.log(`Client ${client.id} joined family:${familyId}`);
    return { event: 'joined', data: familyId };
  }

  @SubscribeMessage('leave_family')
  handleLeaveFamily(client: Socket, familyId: string) {
    client.leave(`family:${familyId}`);
  }

  // ─── Server-side emit helpers ──────────────────────────────

  emitScheduleUpdated(familyId: string, data: Record<string, unknown>) {
    this.server.to(`family:${familyId}`).emit('schedule_updated', data);
  }

  emitProposalReceived(familyId: string, data: Record<string, unknown>) {
    this.server.to(`family:${familyId}`).emit('proposal_received', data);
  }

  emitProposalAccepted(familyId: string, data: Record<string, unknown>) {
    this.server.to(`family:${familyId}`).emit('proposal_accepted', data);
  }

  emitProposalExpired(familyId: string, data: Record<string, unknown>) {
    this.server.to(`family:${familyId}`).emit('proposal_expired', data);
  }

  emitEmergencyChanged(familyId: string, data: Record<string, unknown>) {
    this.server.to(`family:${familyId}`).emit('emergency_changed', data);
  }
}
