import type { PrismaClient } from '../generated/prisma/client.js';
import { NotFoundError } from '../utils/errors.js';

export interface TicketAvailability {
  ticket_id: number;
  name: string;
  price: string;
  total_quota: number;
  available_quota: number;
  last_updated: Date;
}

type AnyPrismaClient = Pick<PrismaClient, '$queryRawUnsafe' | '$queryRaw'>;

const AVAILABILITY_QUERY = `
WITH evaluation AS (
  SELECT clock_timestamp() AS evaluation_time
)
SELECT
  t.id AS ticket_id,
  t.name,
  t.price::text AS price,
  t.total_quota AS total_quota,
  t.total_quota
    - COALESCE((
        SELECT SUM(h.quantity)
        FROM "Hold" h
        WHERE h.ticket_id = t.id
          AND h.status = 'ACTIVE'
          AND h.expires_at > (SELECT evaluation_time FROM evaluation)
      ), 0)
    - COALESCE((
        SELECT SUM(od.quantity)
        FROM "OrderDetail" od
        JOIN "Order" o ON o.id = od.order_id
        WHERE od.ticket_id = t.id
          AND o.status = 'SUCCESS'
      ), 0) AS available_quota,
  (SELECT evaluation_time FROM evaluation) AS last_updated
FROM "Ticket" t
`;

function rowToAvailability(row: Record<string, unknown>): TicketAvailability {
  const availableQuota = Number(row.available_quota);

  if (!Number.isFinite(availableQuota) || availableQuota < 0) {
    // eslint-disable-next-line no-console
    console.error(
      `Inventory invariant violation: ticket ${String(row.ticket_id)} has negative availability ${String(row.available_quota)}`,
    );
    throw new Error(`Inventory invariant violation for ticket ${String(row.ticket_id)}`);
  }

  return {
    ticket_id: Number(row.ticket_id),
    name: String(row.name),
    price: String(row.price),
    total_quota: Number(row.total_quota),
    available_quota: availableQuota,
    last_updated: new Date(String(row.last_updated)),
  };
}

export async function getTicketAvailability(
  prisma: AnyPrismaClient,
  eventId: number,
): Promise<TicketAvailability[]> {
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `${AVAILABILITY_QUERY}
     WHERE t.event_id = $1
     ORDER BY t.id ASC`,
    eventId,
  );

  return rows.map(rowToAvailability);
}

export async function getSingleTicketAvailability(
  prisma: AnyPrismaClient,
  ticketId: number,
): Promise<TicketAvailability> {
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `${AVAILABILITY_QUERY}
     WHERE t.id = $1
     ORDER BY t.id ASC`,
    ticketId,
  );

  const row = rows[0];
  if (!row) {
    throw new NotFoundError('Ticket');
  }

  return rowToAvailability(row);
}

export async function getEventAvailability(
  prisma: AnyPrismaClient,
  eventId: number,
): Promise<TicketAvailability[]> {
  return getTicketAvailability(prisma, eventId);
}
