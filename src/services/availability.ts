export interface TicketAvailability {
  ticket_id: number;
  name: string;
  price: string;
  total_quota: number;
  available_quota: number;
  last_updated: Date;
}

export async function getTicketAvailability(prisma: any, eventId: number): Promise<TicketAvailability[]> {
  const tickets = await prisma.ticket.findMany({
    where: { event_id: eventId },
    include: {
      orderDetails: {
        select: {
          order_id: true,
        },
      },
      holds: {
        where: {
          status: 'ACTIVE',
          expires_at: {
            gt: new Date(),
          },
        },
        select: {
          id: true,
        },
      },
    },
  });

  return tickets.map((ticket: any) => {
    const confirmedCount = ticket.orderDetails.length;
    const activeHoldCount = ticket.holds.length;
    const available_quota = ticket.total_quota - confirmedCount - activeHoldCount;

    return {
      ticket_id: ticket.id,
      name: ticket.name,
      price: ticket.price.toString(),
      total_quota: ticket.total_quota,
      available_quota: Math.max(0, available_quota),
      last_updated: new Date(),
    };
  });
}

export async function getEventAvailability(prisma: any, eventId: number): Promise<TicketAvailability[]> {
  return getTicketAvailability(prisma, eventId);
}

