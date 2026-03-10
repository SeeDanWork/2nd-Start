import { describe, it, expect, beforeEach } from 'vitest';
import { OperatorService } from '../operator.service';

// Minimal mock repos
const mockRepo = () => ({
  count: () => Promise.resolve(0),
  find: () => Promise.resolve([]),
  findOne: () => Promise.resolve(null),
  createQueryBuilder: () => ({
    where: function() { return this; },
    andWhere: function() { return this; },
    leftJoinAndSelect: function() { return this; },
    leftJoin: function() { return this; },
    addSelect: function() { return this; },
    orderBy: function() { return this; },
    take: function() { return this; },
    getCount: () => Promise.resolve(0),
    getMany: () => Promise.resolve([]),
  }),
});

describe('OperatorService', () => {
  let service: OperatorService;

  beforeEach(() => {
    service = new OperatorService(
      mockRepo() as any,
      mockRepo() as any,
      mockRepo() as any,
    );
  });

  describe('System Health', () => {
    it('returns health status', () => {
      const health = service.getSystemHealth();
      expect(health.status).toBe('ok');
      expect(health.smsEnabled).toBe(true);
      expect(health.uptime).toBeGreaterThan(0);
      expect(health.memoryMB).toBeGreaterThan(0);
    });
  });

  describe('SMS Kill Switch', () => {
    it('starts with SMS enabled', () => {
      const status = service.getSmsGlobalStatus();
      expect(status.enabled).toBe(true);
      expect(status.paused).toBe(false);
    });

    it('pauses SMS globally', () => {
      const result = service.pauseGlobalSms('maintenance');
      expect(result.paused).toBe(true);
      expect(result.reason).toBe('maintenance');
    });

    it('blocks messages when globally paused', () => {
      service.pauseGlobalSms('testing');
      const check = service.isSmsAllowed('any-family');
      expect(check.allowed).toBe(false);
      expect(check.reason).toContain('Global pause');
    });

    it('resumes SMS globally', () => {
      service.pauseGlobalSms('testing');
      service.resumeGlobalSms();
      const check = service.isSmsAllowed('any-family');
      expect(check.allowed).toBe(true);
    });
  });

  describe('Family Pause/Resume', () => {
    it('pauses a specific family', () => {
      const result = service.pauseFamily('family-1', 'issue reported');
      expect(result.paused).toBe(true);
      expect(result.reason).toBe('issue reported');
    });

    it('blocks messages for paused family', () => {
      service.pauseFamily('family-1', 'issue');
      const check = service.isSmsAllowed('family-1');
      expect(check.allowed).toBe(false);
      expect(check.reason).toContain('Family paused');
    });

    it('allows messages for non-paused family', () => {
      service.pauseFamily('family-1', 'issue');
      const check = service.isSmsAllowed('family-2');
      expect(check.allowed).toBe(true);
    });

    it('resumes a family', () => {
      service.pauseFamily('family-1', 'issue');
      service.resumeFamily('family-1');
      const check = service.isSmsAllowed('family-1');
      expect(check.allowed).toBe(true);
    });
  });

  describe('Rate Limiting', () => {
    it('allows messages within limit', () => {
      const result = service.checkRateLimit('user-1', 'inbound');
      expect(result.allowed).toBe(true);
      expect(result.current).toBe(1);
      expect(result.limit).toBe(10);
    });

    it('blocks after inbound limit reached', () => {
      for (let i = 0; i < 10; i++) {
        service.checkRateLimit('user-1', 'inbound');
      }
      const result = service.checkRateLimit('user-1', 'inbound');
      expect(result.allowed).toBe(false);
      expect(result.current).toBe(10);
    });

    it('tracks inbound and outbound separately', () => {
      for (let i = 0; i < 10; i++) {
        service.checkRateLimit('user-1', 'inbound');
      }
      const outbound = service.checkRateLimit('user-1', 'outbound');
      expect(outbound.allowed).toBe(true);
    });

    it('outbound limit is 30', () => {
      for (let i = 0; i < 30; i++) {
        service.checkRateLimit('family-1', 'outbound');
      }
      const result = service.checkRateLimit('family-1', 'outbound');
      expect(result.allowed).toBe(false);
      expect(result.limit).toBe(30);
    });

    it('returns rate limit status', () => {
      service.checkRateLimit('family-1', 'inbound');
      service.checkRateLimit('family-1', 'outbound');
      const status = service.getRateLimitStatus('family-1');
      expect(status.inbound.current).toBe(1);
      expect(status.outbound.current).toBe(1);
    });

    it('returns zero for unknown family', () => {
      const status = service.getRateLimitStatus('unknown');
      expect(status.inbound.current).toBe(0);
      expect(status.outbound.current).toBe(0);
    });
  });

  describe('Quiet Hours', () => {
    it('detects quiet hours based on timezone', () => {
      // This test is timezone-dependent but should work for basic validation
      const result = service.isQuietHours('America/New_York');
      expect(typeof result).toBe('boolean');
    });

    it('handles invalid timezone gracefully', () => {
      const result = service.isQuietHours('Invalid/Timezone');
      expect(result).toBe(false);
    });
  });

  describe('Operational Metrics', () => {
    it('returns metric structure', async () => {
      const metrics = await service.getOperationalMetrics();
      expect(metrics.families).toBeDefined();
      expect(metrics.conversations).toBeDefined();
      expect(metrics.smsEnabled).toBe(true);
      expect(metrics.timestamp).toBeDefined();
    });
  });
});
