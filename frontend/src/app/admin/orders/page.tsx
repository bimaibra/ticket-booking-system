import { apiClient } from "@/shared/lib/api";
import type { Order } from "@/modules/orders/types";
import { AdminOrdersTable } from "./_components/admin-orders-table";

export const dynamic = "force-dynamic";

async function getAllOrders(): Promise<Order[]> {
  return apiClient<Order[]>("/admin/orders").catch(() => []);
}

export default async function AdminOrdersPage() {
  const orders = await getAllOrders();

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <h1 className="text-3xl font-medium tracking-tighter">All Orders</h1>
      <p className="mt-2 text-sm text-muted">
        {orders.length} order(s) across all users
      </p>
      <div className="mt-8">
        <AdminOrdersTable initialOrders={orders} />
      </div>
    </div>
  );
}