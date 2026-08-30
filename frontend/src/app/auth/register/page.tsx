"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { pushToast, pushErrorToast } from "@/shared/errors/toast";

const registerSchema = z
  .object({
    username: z.string().min(3, "Username must be at least 3 characters"),
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const { register: registerUser } = useAuth();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterForm) => {
    try {
      await registerUser({
        username: data.username,
        name: data.name,
        email: data.email,
        password: data.password,
      });
      pushToast("Account created. Welcome to Velaris.", "success");
    } catch (err) {
      pushErrorToast(err);
    }
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm rounded-lg border border-line bg-surface p-8">
        <h1 className="text-2xl font-medium tracking-tight">Create account</h1>
        <p className="mt-2 text-sm text-muted">Join Velaris</p>

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
            <label htmlFor="name" className="block text-sm font-medium text-foreground">
              Full Name
            </label>
            <input
              id="name"
              {...register("name")}
              className="mt-1 w-full rounded-md border border-line bg-background px-4 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
            />
            {errors.name && (
              <p className="mt-1 text-xs text-danger">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-foreground">
              Email
            </label>
            <input
              id="email"
              type="email"
              {...register("email")}
              className="mt-1 w-full rounded-md border border-line bg-background px-4 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
            />
            {errors.email && (
              <p className="mt-1 text-xs text-danger">{errors.email.message}</p>
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

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              {...register("confirmPassword")}
              className="mt-1 w-full rounded-md border border-line bg-background px-4 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
            />
            {errors.confirmPassword && (
              <p className="mt-1 text-xs text-danger">{errors.confirmPassword.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-accent py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {isSubmitting ? "Creating account…" : "Register"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          Already have an account?{" "}
          <Link href="/auth/login" className="text-accent hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}