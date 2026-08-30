import { OrderDetail } from "./_components/order-detail";
import { apiClient } from "@/shared/lib/api";
import type { Order } from "@/modules/orders/types";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

async function getOrder(id: number): Promise<Order | null> {
  return apiClient<Order>(`/orders/${id}`).catch(() => null);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const order = await getOrder(Number(id));
  if (!order) return { title: "Order Not Found" };
  return {
    title: `Order #${order.id}`,
    description: `Order total $${parseFloat(order.total_amount).toFixed(2)}`,
  };
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await getOrder(Number(id));
  if (!order) notFound();

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <OrderDetail order={order} />
    </div>
  );
}