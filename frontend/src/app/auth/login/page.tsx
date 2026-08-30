"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { pushErrorToast } from "@/shared/errors/toast";

const loginSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { login } = useAuth();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    try {
      await login(data);
    } catch (err) {
      pushErrorToast(err);
    }
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm rounded-lg border border-line bg-surface p-8">
        <h1 className="text-2xl font-medium tracking-tight">Sign in</h1>
        <p className="mt-2 text-sm text-muted">Welcome back to Velaris</p>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-foreground">
              Username
            </label>
            <input
              id="username"
              {...register("username")}
              className="mt-1 w-full rounded-md border border-line bg-background px-4 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
            />
            {errors.username && (
              <p className="mt-1 text-xs text-danger">{errors.username.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-foreground">
              Password
            </label>
            <input
              id="password"
              type="password"
              {...register("password")}
              className="mt-1 w-full rounded-md border border-line bg-background px-4 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
            />
            {errors.password && (
              <p className="mt-1 text-xs text-danger">{errors.password.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-accent py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {isSubmitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          Don&apos;t have an account?{" "}
          <Link href="/auth/register" className="text-accent hover:underline">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}