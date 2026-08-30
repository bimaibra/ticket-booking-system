"use client";

import { useAdminUsers, useUpdateUserRole } from "@/modules/admin/queries";
import type { AdminUser, Role } from "@/modules/admin/types";
import { cn } from "@/shared/lib/cn";
import { useState } from "react";
import { pushToast, pushErrorToast } from "@/shared/errors/toast";

export function AdminUsersTable({ initialUsers }: { initialUsers: AdminUser[] }) {
  const { data: users = initialUsers } = useAdminUsers();
  const updateRole = useUpdateUserRole();

  const handleRoleChange = async (id: number, role: Role) => {
    try {
      await updateRole.mutateAsync({ id, role });
      pushToast("User role updated successfully.", "success");
    } catch {
      pushErrorToast("Failed to update user role.");
    }
  };

  if (users.length === 0) {
    return (
      <div className="rounded-lg border border-line bg-surface p-8 text-center text-muted">
        No users yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-line bg-surface overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-subtle text-left text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-3">Username</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-subtle/50">
                <td className="px-4 py-3 font-mono text-xs">{u.username}</td>
                <td className="px-4 py-3">{u.name}</td>
                <td className="px-4 py-3 text-muted">{u.email}</td>
                <td className="px-4 py-3">
                  <select
                    value={u.role}
                    onChange={(e) => handleRoleChange(u.id, e.target.value as Role)}
                    disabled={updateRole.isPending}
                    className={cn(
                      "rounded-md border border-line bg-background px-2 py-1 text-xs font-mono"
                    )}
                  >
                    <option value="USER">USER</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}