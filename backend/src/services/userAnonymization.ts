import { createHash } from 'node:crypto';
import type { PrismaClient } from '../generated/prisma/client.js';

export async function anonymizeUser(prisma: PrismaClient, userId: number): Promise<void> {
  const surrogateHash = createHash('sha256').update(`deleted-user-${userId}-${Date.now()}`).digest('hex').slice(0, 16);

  await prisma.user.update({
    where: { id: userId },
    data: {
      username: `deleted_${surrogateHash}`,
      name: 'Anonymized User',
      email: `deleted_${surrogateHash}@deleted.local`,
      password_hash: '$2b$12$ANONYMIZED_USER_PASSWORD_HASH_PLACEHOLDER___________',
      refresh_token: null,
    },
  });
}
