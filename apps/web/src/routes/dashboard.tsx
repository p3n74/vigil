import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { ImageIcon, Loader2, Trash2 } from "lucide-react";
import { useRef, useState } from "react";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/utils/trpc";
import { NotWhitelistedView } from "@/components/not-whitelisted-view";

export const Route = createFileRoute("/dashboard")({
  component: RouteComponent,
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data) {
      throw redirect({
        to: "/",
      });
    }
    return { session };
  },
});

function RouteComponent() {
  const { session } = Route.useRouteContext();

  const roleQueryOptions = trpc.team.getMyRole.queryOptions();
  const roleQuery = useQuery(roleQueryOptions);

  const postsQueryOptions = trpc.posts.feed.queryOptions({
    limit: 20,
  });
  const postsQuery = useQuery(postsQueryOptions);

  const isWhitelisted = (roleQuery.data?.role ?? null) !== null;
  const role = roleQuery.data?.role ?? null;
  const canPost = role === "AUTHOR" || role === "ADMIN";

  if (roleQuery.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (roleQuery.isSuccess && !isWhitelisted) {
    return <NotWhitelistedView />;
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl min-w-0 flex-col gap-4 px-3 py-4 sm:gap-6 sm:px-4 sm:py-6">
      <div className="flex flex-col gap-1">
        <p className="text-xs font-medium uppercase tracking-widest text-primary">Vigil</p>
        <h1 className="text-3xl font-bold tracking-tight">Your private feed</h1>
        <p className="text-muted-foreground">
          Signed in as {session.data?.user?.email}. Role: {role ?? "None"}
        </p>
      </div>

      {canPost && <PostComposer />}

      <Feed postsQuery={postsQuery} canModerate={role === "ADMIN"} />
    </div>
  );
}

type FeedProps = {
  postsQuery: ReturnType<typeof useQuery<typeof trpc.posts.feed.queryOptions>>;
  canModerate: boolean;
};

function Feed({ postsQuery, canModerate }: FeedProps) {
  const utils = trpc;

  const deleteMutation = utils.posts.delete.useMutation({
    onSuccess: () => {
      postsQuery.refetch();
    },
  });

  if (postsQuery.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const posts = postsQuery.data?.items ?? [];

  if (!posts.length) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          No posts yet. Be the first to share something.
        </CardContent>
      </Card>
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

function PostComposer() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const postsClient = trpc.posts;
  const createMutation = postsClient.create.useMutation();
  const feedQueryOptions = trpc.posts.feed.queryOptions({ limit: 20 });

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

      await feedQueryOptions.queryFn();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create a post</CardTitle>
        <CardDescription>Share a photo with your Vigil feed.</CardDescription>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  );
}
