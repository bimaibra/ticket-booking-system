import { apiClient } from "@/shared/lib/api";
import type { AdminUser } from "@/modules/admin/types";
import { AdminUsersTable } from "./_components/admin-users-table";

export const dynamic = "force-dynamic";

async function getUsers(): Promise<AdminUser[]> {
  return apiClient<AdminUser[]>("/admin/users").catch(() => []);
}

export default async function AdminUsersPage() {
  const users = await getUsers();

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <h1 className="text-3xl font-medium tracking-tighter">Users</h1>
      <p className="mt-2 text-sm text-muted">
        {users.length} user(s) registered
      </p>
      <div className="mt-8">
        <AdminUsersTable initialUsers={users} />
      </div>
    </div>
  );
}