import { OrderList } from "./_components/order-list";
import { apiClient } from "@/shared/lib/api";
import type { Order } from "@/modules/orders/types";

export const dynamic = "force-dynamic";

async function getOrders(): Promise<Order[]> {
  return apiClient<Order[]>("/orders").catch(() => []);
}

export default async function OrdersPage() {
  const orders = await getOrders();

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <section className="mb-10">
        <h1 className="text-4xl font-medium tracking-tighter">Order History</h1>
        <p className="mt-3 max-w-[60ch] text-muted">
          Completed bookings. Orders are immutable once confirmed.
        </p>
      </section>

      <OrderList initialOrders={orders} />
    </div>
  );
}