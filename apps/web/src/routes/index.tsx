import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  Trash2,
  Eye,
  Camera,
  BookOpen,
  ImageIcon,
  Loader2,
  Plus,
  Grid3X3,
  Rows3,
  Heart,
  MessageCircle,
} from "lucide-react";

import { authClient } from "@/lib/auth-client";
import { NotWhitelistedView } from "@/components/not-whitelisted-view";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogHeader, DialogPopup, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
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
  const roleQuery = useQuery(trpc.team.getMyRole.queryOptions());
  const postsQueryOptions = trpc.posts.feed.queryOptions({
    limit: 20,
  });
  const postsQuery = useQuery(postsQueryOptions);
  const role = roleQuery.data?.role ?? null;
  const canPost = role === "AUTHOR" || role === "ADMIN";
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  return (
    <div className="mx-auto flex w-full max-w-3xl min-w-0 flex-col gap-4 px-3 py-4 sm:gap-6 sm:px-4 sm:py-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
        <p className="text-xs font-medium uppercase tracking-widest text-primary">Vigil</p>
        <h1 className="text-3xl font-bold tracking-tight">
          Home feed
        </h1>
        {error ? (
          <p className="text-destructive">
            Failed to load permissions: {error}. Please ensure the server is running.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Latest moments from you and your circle.
          </p>
        )}
        </div>
        {canPost && (
          <CreatePostDialog onPosted={() => postsQuery.refetch()} />
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Feed view</p>
        <div className="inline-flex items-center gap-1 rounded-lg border border-border/60 bg-background/50 p-1">
          <Button
            size="sm"
            variant={viewMode === "list" ? "default" : "ghost"}
            className="gap-1.5"
            onClick={() => setViewMode("list")}
          >
            <Rows3 className="size-3.5" />
            List
          </Button>
          <Button
            size="sm"
            variant={viewMode === "grid" ? "default" : "ghost"}
            className="gap-1.5"
            onClick={() => setViewMode("grid")}
          >
            <Grid3X3 className="size-3.5" />
            Grid
          </Button>
        </div>
      </div>

      <Feed
        posts={postsQuery.data?.items ?? []}
        isLoading={postsQuery.isLoading}
        onRefresh={() => postsQuery.refetch()}
        canModerate={role === "ADMIN"}
        viewMode={viewMode}
      />
      {canPost && <CreatePostDialog onPosted={() => postsQuery.refetch()} floating />}
    </div>
  );
}

function CreatePostDialog({ onPosted, floating = false }: { onPosted: () => void; floating?: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        className={
          floating
            ? "fixed bottom-6 right-5 z-40 size-14 rounded-full shadow-xl md:hidden"
            : "hidden shrink-0 gap-2 md:inline-flex"
        }
        size={floating ? "icon-lg" : "default"}
        onClick={() => setOpen(true)}
        aria-label="Create post"
      >
        <Plus className="size-4" />
        {!floating && "Create post"}
      </Button>
      <DialogPopup className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Create a post</DialogTitle>
        </DialogHeader>
        <PostComposer
          onPosted={() => {
            onPosted();
            setOpen(false);
          }}
        />
      </DialogPopup>
    </Dialog>
  );
}

type FeedProps = {
  posts: Array<{
    id: string;
    imageUrl: string;
    caption: string | null;
    createdAt: string;
    author: {
      name: string | null;
    };
  }>;
  isLoading: boolean;
  onRefresh: () => void;
  canModerate: boolean;
  viewMode: "list" | "grid";
};

function Feed({ posts, isLoading, onRefresh, canModerate, viewMode }: FeedProps) {
  const deleteMutation = useMutation(
    trpc.posts.delete.mutationOptions({
      onSuccess: () => {
        onRefresh();
      },
    }),
  );
  const [likedPosts, setLikedPosts] = useState<Record<string, boolean>>({});

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!posts.length) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          No posts yet. Be the first to share something.
        </CardContent>
      </Card>
    );
  }

  if (viewMode === "grid") {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {posts.map((post) => (
          <Card key={post.id} className="overflow-hidden p-2">
            <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-muted">
              <img
                src={post.imageUrl}
                alt={post.caption ?? "Post image"}
                className="h-full w-full object-cover transition-transform duration-200 hover:scale-105"
              />
            </div>
            <div className="mt-2 flex items-center justify-between gap-1">
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2"
                  onClick={() =>
                    setLikedPosts((prev) => ({
                      ...prev,
                      [post.id]: !prev[post.id],
                    }))
                  }
                >
                  <Heart className={`size-4 ${likedPosts[post.id] ? "fill-current text-rose-500" : ""}`} />
                </Button>
                <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => toast.message("Comments coming soon")}>
                  <MessageCircle className="size-4" />
                </Button>
              </div>
              {canModerate && (
                <Button
                  size="icon-xs"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => deleteMutation.mutate({ id: post.id })}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {posts.map((post) => (
        <Card key={post.id} className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">
                {post.author.name ?? "Unknown user"}
              </CardTitle>
              <CardDescription>
                {new Date(post.createdAt).toLocaleString()}
              </CardDescription>
            </div>
            {canModerate && (
              <Button
                size="icon"
                variant="ghost"
                className="text-destructive"
                onClick={() => deleteMutation.mutate({ id: post.id })}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative aspect-[4/5] w-full overflow-hidden rounded-xl bg-muted">
              <img
                src={post.imageUrl}
                alt={post.caption ?? "Post image"}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="gap-2"
                onClick={() =>
                  setLikedPosts((prev) => ({
                    ...prev,
                    [post.id]: !prev[post.id],
                  }))
                }
              >
                <Heart className={`size-4 ${likedPosts[post.id] ? "fill-current text-rose-500" : ""}`} />
                {likedPosts[post.id] ? "Liked" : "Like"}
              </Button>
              <Button size="sm" variant="ghost" className="gap-2" onClick={() => toast.message("Comments coming soon")}>
                <MessageCircle className="size-4" />
                Comment
              </Button>
            </div>
            {post.caption && (
              <p className="text-sm text-foreground whitespace-pre-wrap">
                {post.caption}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function PostComposer({ onPosted }: { onPosted: () => void }) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createMutation = useMutation(trpc.posts.create.mutationOptions());

  const handlePickFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;
    if (!nextFile) {
      setFile(null);
      setPreviewUrl(null);
      return;
    }
    setFile(nextFile);
    setPreviewUrl(URL.createObjectURL(nextFile));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file) {
      return;
    }

    try {
      setIsSubmitting(true);

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const data = (await response.json()) as { imageUrl: string };

      await createMutation.mutateAsync({
        imageUrl: data.imageUrl,
        caption: caption.trim() || undefined,
      });

      setFile(null);
      setPreviewUrl(null);
      setCaption("");

      onPosted();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <input
        type="file"
        accept="image/*"
        className="hidden"
        ref={fileInputRef}
        onChange={handleFileChange}
      />
      <Button
        type="button"
        variant="outline"
        className="w-full justify-center gap-2"
        onClick={handlePickFile}
      >
        <ImageIcon className="size-4" />
        {file ? "Change image" : "Choose image"}
      </Button>
      {previewUrl && (
        <div className="relative aspect-[4/5] w-full overflow-hidden rounded-xl bg-muted">
          <img
            src={previewUrl}
            alt="Preview"
            className="h-full w-full object-cover"
          />
        </div>
      )}
      <Textarea
        placeholder="Write a short caption (optional)..."
        value={caption}
        onChange={(event) => setCaption(event.target.value)}
        rows={3}
      />
      <Button
        type="submit"
        className="w-full"
        disabled={!file || isSubmitting}
      >
        {isSubmitting ? "Posting..." : "Post to Vigil"}
      </Button>
    </form>
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
