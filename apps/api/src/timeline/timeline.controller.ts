import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { TimelineEngineService } from './timeline-engine.service';
import { PersonaEmulatorService } from './personas/persona-emulator.service';
import { TimelineEventType, TimelineConfig } from './timeline-event.types';
import { PERSONA_LIBRARY, getPersonaPair, listPersonaPairs } from './personas/persona-library';

@Controller('timelines')
export class TimelineController {
  constructor(
    private readonly engine: TimelineEngineService,
    private readonly personaEmulator: PersonaEmulatorService,
  ) {}

  // ── Lifecycle ────────────────────────────────────────────

  @Post()
  create(@Body() config: TimelineConfig) {
    return this.engine.create(config);
  }

  @Get()
  list(@Query('familyId') familyId?: string) {
    return this.engine.listTimelines(familyId);
  }

  @Get(':id')
  getStatus(@Param('id') id: string) {
    const status = this.engine.getStatus(id);
    if (!status) throw new NotFoundException('Timeline not found');
    return status;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  destroy(@Param('id') id: string) {
    if (!this.engine.destroy(id)) {
      throw new NotFoundException('Timeline not found');
    }
  }

  // ── Event Queue ──────────────────────────────────────────

  @Post(':id/events')
  enqueueEvent(
    @Param('id') id: string,
    @Body() body: {
      type: TimelineEventType;
      scheduledAt: string;
      actorId?: string;
      familyId: string;
      payload: Record<string, unknown>;
    },
  ) {
    return this.engine.enqueueEvent(id, {
      type: body.type,
      scheduledAt: new Date(body.scheduledAt),
      actorId: body.actorId || null,
      familyId: body.familyId,
      payload: body.payload,
    });
  }

  @Post(':id/events/batch')
  enqueueBatch(
    @Param('id') id: string,
    @Body() body: {
      events: Array<{
        type: TimelineEventType;
        scheduledAt: string;
        actorId?: string;
        familyId: string;
        payload: Record<string, unknown>;
      }>;
    },
  ) {
    return this.engine.enqueueEvents(
      id,
      body.events.map(e => ({
        type: e.type,
        scheduledAt: new Date(e.scheduledAt),
        actorId: e.actorId || null,
        familyId: e.familyId,
        payload: e.payload,
      })),
    );
  }

  @Post(':id/seed-system-events')
  seedSystemEvents(@Param('id') id: string) {
    const count = this.engine.seedSystemEvents(id);
    return { seeded: count };
  }

  // ── Processing ───────────────────────────────────────────

  @Post(':id/advance-to')
  advanceTo(
    @Param('id') id: string,
    @Body() body: { date: string },
  ) {
    return this.engine.advanceTo(id, body.date);
  }

  @Post(':id/advance-day')
  advanceOneDay(@Param('id') id: string) {
    return this.engine.advanceOneDay(id);
  }

  @Post(':id/run')
  runToCompletion(@Param('id') id: string) {
    return this.engine.runToCompletion(id);
  }

  // ── Checkpoints ──────────────────────────────────────────

  @Post(':id/checkpoints')
  createCheckpoint(
    @Param('id') id: string,
    @Body() body: { label: string },
  ) {
    return this.engine.createCheckpoint(id, body.label);
  }

  // ── SMS Log ──────────────────────────────────────────────

  @Get(':id/sms-log')
  getSmsLog(@Param('id') id: string) {
    return this.engine.getSmsLog(id);
  }

  // ── Personas ─────────────────────────────────────────────

  @Get('personas/pairs')
  listPairs() {
    return listPersonaPairs();
  }

  @Get('personas/library')
  getLibrary() {
    return PERSONA_LIBRARY;
  }

  @Post(':id/personas/seed')
  seedPersonaActions(
    @Param('id') id: string,
    @Body() body: {
      personaId: string;
      familyId: string;
      seed?: number;
    },
  ) {
    const persona = PERSONA_LIBRARY[body.personaId];
    if (!persona) throw new NotFoundException(`Persona "${body.personaId}" not found`);

    const status = this.engine.getStatus(id);
    if (!status) throw new NotFoundException('Timeline not found');

    const events = this.personaEmulator.generateActions(
      persona,
      body.familyId,
      status.config.startDate,
      status.config.endDate,
      body.seed ?? 42,
    );

    const enqueued = this.engine.enqueueEvents(id, events);
    return { personaId: body.personaId, eventsEnqueued: enqueued.length };
  }

  @Post(':id/personas/seed-pair')
  seedPersonaPair(
    @Param('id') id: string,
    @Body() body: {
      pairName: string;
      familyId: string;
      seed?: number;
    },
  ) {
    const pair = getPersonaPair(body.pairName);
    if (!pair) throw new NotFoundException(`Persona pair "${body.pairName}" not found`);

    const status = this.engine.getStatus(id);
    if (!status) throw new NotFoundException('Timeline not found');

    const [personaA, personaB] = pair;
    const eventsA = this.personaEmulator.generateActions(
      personaA,
      body.familyId,
      status.config.startDate,
      status.config.endDate,
      body.seed ?? 42,
    );
    const eventsB = this.personaEmulator.generateActions(
      personaB,
      body.familyId,
      status.config.startDate,
      status.config.endDate,
      (body.seed ?? 42) + 1000,
    );

    const enqueuedA = this.engine.enqueueEvents(id, eventsA);
    const enqueuedB = this.engine.enqueueEvents(id, eventsB);

    return {
      pairName: body.pairName,
      parentA: { personaId: personaA.id, eventsEnqueued: enqueuedA.length },
      parentB: { personaId: personaB.id, eventsEnqueued: enqueuedB.length },
      totalEvents: enqueuedA.length + enqueuedB.length,
    };
  }
}
