import { describe, it, expect, vi } from 'vitest';
import { anonymizeUser } from '../../src/services/userAnonymization.js';

describe('User Anonymization Service', () => {
  it('anonymizes PII fields while keeping the user record', async () => {
    const mockPrisma = {
      user: {
        update: vi.fn().mockResolvedValue({ id: 42 }),
      },
    };

    await anonymizeUser(mockPrisma as any, 42);

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 42 },
      data: expect.objectContaining({
        name: 'Anonymized User',
        refresh_token: null,
        username: expect.stringMatching(/^deleted_/),
        email: expect.stringMatching(/^deleted_.*@deleted\.local$/),
      }),
    });
  });
});
