import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  LayoutDashboard,
  Eye,
  Camera,
  BookOpen,
  ImageIcon,
  Users,
  Loader2,
} from "lucide-react";

import { authClient } from "@/lib/auth-client";
import { NotWhitelistedView } from "@/components/not-whitelisted-view";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

function LandingPage() {
  const { data: session, isPending, error: authError } = authClient.useSession();
  const roleQuery = useQuery({
    ...trpc.team.getMyRole.queryOptions(),
    enabled: !!session,
    retry: false,
  });
  
  const isWhitelisted = (roleQuery.data?.role ?? null) !== null;

  // If there's an error connecting to the auth service, assume signed out for the landing page
  if (authError) {
    return <SignedOutHome />;
  }

  if (isPending) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-muted-foreground flex items-center gap-2">
          <Loader2 className="animate-spin size-4" />
          Loading...
        </div>
      </div>
    );
  }

  // Signed in but not whitelisted: show forbidden
  if (session && roleQuery.isSuccess && !isWhitelisted) {
    return <NotWhitelistedView />;
  }

  // Handle case where session exists but role query failed
  if (session && roleQuery.isError) {
    return <SignedInHome error={roleQuery.error?.message} />;
  }

  // Show home view if signed in
  if (session) {
    return <SignedInHome />;
  }

  return <SignedOutHome />;
}

function SignedInHome({ error }: { error?: string }) {
  const { data: session } = authClient.useSession();
  const roleQuery = useQuery(trpc.team.getMyRole.queryOptions());

  return (
    <div className="mx-auto max-w-6xl min-w-0 px-3 py-6 sm:px-4 sm:py-8 text-center">
      <div className="mb-8">
        <p className="text-xs font-medium uppercase tracking-widest text-primary">Vigil</p>
        <h1 className="text-4xl font-bold tracking-tight mb-2">
          Welcome back, {session?.user.name?.split(" ")[0] ?? "User"}
        </h1>
        {error ? (
          <p className="text-destructive max-w-2xl mx-auto">
            Failed to load permissions: {error}. Please ensure the server is running.
          </p>
        ) : (
          <p className="text-muted-foreground max-w-2xl mx-auto">
            You are currently signed in as <span className="text-foreground font-medium">{session?.user.email}</span> 
            with the role <span className="text-primary font-semibold">{roleQuery.data?.role ?? "None"}</span>.
          </p>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2 max-w-2xl mx-auto">
        <Card className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => window.location.href = '/dashboard'}>
          <CardHeader>
            <div className="mx-auto bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center mb-2">
              <LayoutDashboard className="text-primary" />
            </div>
            <CardTitle>Go to Dashboard</CardTitle>
            <CardDescription>View your personalized workspace</CardDescription>
          </CardHeader>
        </Card>

        <Card className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => window.location.href = '/team'}>
          <CardHeader>
            <div className="mx-auto bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center mb-2">
              <Users className="text-primary" />
            </div>
            <CardTitle>Manage Team</CardTitle>
            <CardDescription>Configure users and permissions</CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}

function SignedOutHome() {
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    const callbackURL = typeof window === "undefined" ? "/" : `${window.location.origin}/`;
    setIsGoogleLoading(true);
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL,
      });
    } catch (error) {
      toast.error("Google sign in failed. Please try again.");
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-80px)] items-center justify-center px-4">
      <Card className="glass border-border/50 shadow-2xl w-full max-w-3xl overflow-hidden">
        <div className="grid md:grid-cols-2">
          {/* Left side - Sign in */}
          <div className="flex flex-col justify-center p-8 sm:p-10">
            <div className="flex items-center gap-2.5 mb-6">
              <Eye className="size-7 text-primary" />
              <h1 className="text-2xl font-bold tracking-tight">Vigil</h1>
            </div>
            <p className="text-sm text-muted-foreground mb-8">
              Sign in to access your private feed.
            </p>
            <Button
              type="button"
              className="w-full h-12 text-base"
              onClick={handleGoogleSignIn}
              disabled={isGoogleLoading}
            >
              {isGoogleLoading ? "Connecting..." : "Sign in with Google"}
            </Button>
          </div>

          {/* Right side - App description */}
          <div className="hidden md:flex flex-col justify-center gap-6 border-l border-border/50 bg-muted/20 p-8 sm:p-10">
            <div>
              <h2 className="text-lg font-semibold mb-1">Your private photo journal</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                A whitelisted space for you and the people you trust to share 
                pictures, stories, and everyday moments.
              </p>
            </div>
            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Camera className="size-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Share photos</p>
                  <p className="text-xs text-muted-foreground">Post pictures with captions to your feed.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <BookOpen className="size-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Tell your stories</p>
                  <p className="text-xs text-muted-foreground">Add context to your moments with short write-ups.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <ImageIcon className="size-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Invitation only</p>
                  <p className="text-xs text-muted-foreground">Only whitelisted members can view and post.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
