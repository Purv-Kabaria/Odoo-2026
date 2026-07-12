"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { CheckCircle2, LockKeyhole, Mail, User } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { readApiResponse } from "@/lib/api-client"
import { dashboardHrefForRole } from "@/lib/navigation"
import type { Role } from "@prisma/client"

type AuthMode = "login" | "signup"

type AuthFormProps = {
  mode: AuthMode
}

type AuthResponse = {
  data?: {
    user?: {
      role?: Role
    }
  }
}

function AuthForm({ mode }: AuthFormProps) {
  const isSignup = mode === "signup"
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [formState, setFormState] = React.useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    rememberMe: true,
  })

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    setIsSubmitting(true)
    try {
      const response = await fetch(isSignup ? "/api/auth/signup" : "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formState),
      })
      const json = await readApiResponse<AuthResponse>(
        response,
        isSignup ? "Could not create account" : "Could not sign in",
      )

      toast.success(isSignup ? "Account created" : "Signed in")
      router.push(json.data?.user?.role ? dashboardHrefForRole(json.data.user.role) : "/account")
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="space-y-4 pt-1" onSubmit={handleSubmit} noValidate>
      {isSignup ? (
        <div className="space-y-2">
          <Label htmlFor="name" className="flex items-center gap-2">
            <User className="size-4 text-muted-foreground" /> Full name
          </Label>
          <Input
            id="name"
            autoComplete="name"
            value={formState.name}
            onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))}
            placeholder="Jane Doe"
            required
          />
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="email" className="flex items-center gap-2">
          <Mail className="size-4 text-muted-foreground" /> Email address
        </Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          value={formState.email}
          onChange={(event) => setFormState((current) => ({ ...current, email: event.target.value }))}
          placeholder="you@example.com"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password" className="flex items-center gap-2">
          <LockKeyhole className="size-4 text-muted-foreground" /> Password
        </Label>
        <Input
          id="password"
          type="password"
          autoComplete={isSignup ? "new-password" : "current-password"}
          value={formState.password}
          onChange={(event) => setFormState((current) => ({ ...current, password: event.target.value }))}
          placeholder="********"
          minLength={8}
          required
        />
      </div>

      {isSignup ? (
        <div className="space-y-2">
          <Label htmlFor="confirm-password" className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-muted-foreground" /> Confirm password
          </Label>
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            value={formState.confirmPassword}
            onChange={(event) =>
              setFormState((current) => ({ ...current, confirmPassword: event.target.value }))
            }
            placeholder="Repeat your password"
            minLength={8}
            required
          />
        </div>
      ) : null}

      {!isSignup ? (
        <div className="flex items-center justify-between gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <Checkbox
              checked={formState.rememberMe}
              onCheckedChange={(checked) =>
                setFormState((current) => ({ ...current, rememberMe: checked === true }))
              }
              className="cursor-pointer"
            />
            Remember me
          </label>
          <Button asChild variant="link" className="px-0 text-sm">
            <Link href="/forgot-password" className="cursor-pointer">
              Forgot password?
            </Link>
          </Button>
        </div>
      ) : null}

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? (isSignup ? "Creating..." : "Signing in...") : isSignup ? "Create account" : "Sign in"}
      </Button>
    </form>
  )
}

export { AuthForm }
