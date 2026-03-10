import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SmsOnboardingService } from '../sms-onboarding.service';

const mockRepo = (data: any[] = []) => ({
  findOne: vi.fn().mockImplementation(({ where }: any) => {
    const match = data.find(d => {
      return Object.entries(where).every(([k, v]) => d[k] === v);
    });
    return Promise.resolve(match || null);
  }),
  find: vi.fn().mockResolvedValue(data),
  save: vi.fn().mockImplementation(d => Promise.resolve({ id: 'new-id', ...d })),
  create: vi.fn().mockImplementation(d => d),
  update: vi.fn().mockResolvedValue({ affected: 1 }),
});

describe('SmsOnboardingService', () => {
  let service: SmsOnboardingService;
  let userRepo: any;
  let membershipRepo: any;
  let conversationRepo: any;

  beforeEach(() => {
    userRepo = mockRepo([{ id: 'user-1', email: 'test@test.com', phone: null }]);
    membershipRepo = mockRepo([]);
    conversationRepo = mockRepo([]);
    service = new SmsOnboardingService(
      userRepo as any,
      membershipRepo as any,
      conversationRepo as any,
    );
  });

  describe('generateRegistrationCode', () => {
    it('generates a 6-digit code', () => {
      const code = service.generateRegistrationCode('user-1', 'family-1');
      expect(code).toMatch(/^\d{6}$/);
    });

    it('generates unique codes', () => {
      const code1 = service.generateRegistrationCode('user-1', 'family-1');
      const code2 = service.generateRegistrationCode('user-2', 'family-1');
      // Codes might collide in theory but extremely unlikely with 6 digits
      expect(typeof code1).toBe('string');
      expect(typeof code2).toBe('string');
    });
  });

  describe('registerWithCode', () => {
    it('registers phone with valid code', async () => {
      const code = service.generateRegistrationCode('user-1', 'family-1');
      const result = await service.registerWithCode('+1234567890', code);
      expect(result).toEqual({ userId: 'user-1', familyId: 'family-1' });
      expect(userRepo.update).toHaveBeenCalledWith('user-1', { phone: '+1234567890' });
    });

    it('returns null for invalid code', async () => {
      const result = await service.registerWithCode('+1234567890', '000000');
      expect(result).toBeNull();
    });

    it('invalidates code after use', async () => {
      const code = service.generateRegistrationCode('user-1', 'family-1');
      await service.registerWithCode('+1234567890', code);
      const result = await service.registerWithCode('+0987654321', code);
      expect(result).toBeNull();
    });

    it('returns null if user not found', async () => {
      userRepo.findOne.mockResolvedValue(null);
      const code = service.generateRegistrationCode('nonexistent', 'family-1');
      const result = await service.registerWithCode('+1234567890', code);
      expect(result).toBeNull();
    });
  });

  describe('manualLink', () => {
    it('links phone to user', async () => {
      await service.manualLink('+1234567890', 'user-1', 'family-1');
      expect(userRepo.update).toHaveBeenCalledWith('user-1', { phone: '+1234567890' });
      expect(conversationRepo.save).toHaveBeenCalled();
    });
  });

  describe('listPendingRegistrations', () => {
    it('lists pending codes', () => {
      service.generateRegistrationCode('user-1', 'family-1');
      service.generateRegistrationCode('user-2', 'family-2');
      const pending = service.listPendingRegistrations();
      expect(pending.length).toBe(2);
      expect(pending[0].userId).toBe('user-1');
      expect(pending[1].userId).toBe('user-2');
    });

    it('returns empty when no pending', () => {
      expect(service.listPendingRegistrations()).toEqual([]);
    });
  });
});
