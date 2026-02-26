import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  LayoutDashboard,
  Shield,
  Zap,
  Github,
  CheckCircle2,
  Users,
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
  const { data: session, isPending } = authClient.useSession();
  const roleQuery = useQuery({
    ...trpc.team.getMyRole.queryOptions(),
    enabled: !!session,
  });
  
  const isWhitelisted = (roleQuery.data?.role ?? null) !== null;

  if (isPending) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Signed in but not whitelisted: show forbidden
  if (session && roleQuery.isSuccess && !isWhitelisted) {
    return <NotWhitelistedView />;
  }

  // Show home view if signed in
  if (session) {
    return <SignedInHome />;
  }

  return <SignedOutHome />;
}

function SignedInHome() {
  const { data: session } = authClient.useSession();
  const roleQuery = useQuery(trpc.team.getMyRole.queryOptions());

  return (
    <div className="mx-auto max-w-6xl min-w-0 px-3 py-6 sm:px-4 sm:py-8 text-center">
      <div className="mb-8">
        <p className="text-xs font-medium uppercase tracking-widest text-primary">Overview</p>
        <h1 className="text-4xl font-bold tracking-tight mb-2">
          Welcome back, {session?.user.name?.split(" ")[0] ?? "User"}
        </h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          You are currently signed in as <span className="text-foreground font-medium">{session?.user.email}</span> 
          with the role <span className="text-primary font-semibold">{roleQuery.data?.role ?? "None"}</span>.
        </p>
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
  return (
    <div className="flex flex-col min-h-[calc(100vh-80px)]">
      {/* Hero Section */}
      <section className="flex-1 flex flex-col items-center justify-center px-4 py-12 sm:py-24 text-center">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-6 animate-fade-in">
            <Zap className="w-3 h-3 fill-current" />
            <span>Modern UI/UX Template</span>
          </div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
            The ultimate foundation for your <span className="text-primary">SaaS project</span>
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
            A production-ready monorepo template featuring React, tRPC, Prisma, and Better-Auth. 
            Focus on your features, not the boilerplate.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" asChild className="px-8 h-12 text-base font-semibold">
              <a href="#login">Get Started</a>
            </Button>
            <Button size="lg" variant="outline" asChild className="px-8 h-12 text-base font-semibold gap-2">
              <a href="https://github.com">
                <Github className="w-5 h-5" />
                View Source
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 bg-muted/30">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Everything you need included</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              We've pre-configured the best tools in the ecosystem so you can build with confidence.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<Shield className="w-6 h-6 text-primary" />}
              title="Secure Auth"
              description="Full authentication suite with Better-Auth. Supports Google, GitHub, and more out of the box."
            />
            <FeatureCard 
              icon={<Zap className="w-6 h-6 text-primary" />}
              title="End-to-End Type Safety"
              description="Built with tRPC for a seamless developer experience and zero-runtime overhead type checking."
            />
            <FeatureCard 
              icon={<CheckCircle2 className="w-6 h-6 text-primary" />}
              title="Clean UI/UX"
              description="Beautifully designed components using shadcn/ui, Tailwind CSS, and TanStack Router."
            />
          </div>
        </div>
      </section>

      {/* Login Section */}
      <section id="login" className="py-20 flex items-center justify-center bg-background">
        <div className="w-full max-w-md px-4">
          <LoginCard />
        </div>
      </section>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <Card className="bg-background border-none shadow-none text-center">
      <CardHeader>
        <div className="mx-auto mb-4 bg-primary/10 w-12 h-12 rounded-lg flex items-center justify-center">
          {icon}
        </div>
        <CardTitle className="text-xl mb-2">{title}</CardTitle>
        <CardDescription className="text-base">{description}</CardDescription>
      </CardHeader>
    </Card>
  );
}

function LoginCard() {
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
    <Card className="border-primary/20 shadow-xl">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">Sign In</CardTitle>
        <CardDescription>
          Access your account via Google
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          type="button"
          className="w-full h-12 text-base"
          onClick={handleGoogleSignIn}
          disabled={isGoogleLoading}
        >
          {isGoogleLoading ? "Connecting..." : "Continue with Google"}
        </Button>
        <p className="text-center text-xs text-muted-foreground mt-4">
          By signing in, you agree to our Terms of Service and Privacy Policy.
        </p>
      </CardContent>
    </Card>
  );
}
