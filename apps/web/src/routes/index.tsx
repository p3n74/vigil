import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
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
  ArrowLeft,
  ArrowRight,
  X,
} from "lucide-react";

import { authClient } from "@/lib/auth-client";
import { NotWhitelistedView } from "@/components/not-whitelisted-view";
import { PostImageCarousel } from "@/components/post-image-carousel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogHeader, DialogPopup, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { formatPostDate } from "@/lib/format-date";
import { resolveMediaUrl } from "@/lib/media-url";
import { trpc, trpcClient } from "@/utils/trpc";

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

const PAGE_SIZE = 10;

function SignedInHome({ error }: { error?: string }) {
  const roleQuery = useQuery(trpc.team.getMyRole.queryOptions());
  const role = roleQuery.data?.role ?? null;
  const canPost = role === "AUTHOR" || role === "ADMIN";
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  const [pages, setPages] = useState<FeedPost[][]>([]);
  const [cursor, setCursor] = useState<string | null | undefined>(undefined);
  const [isLoadingPage, setIsLoadingPage] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const initialQuery = useQuery(trpc.posts.feed.queryOptions({ limit: PAGE_SIZE }));

  useEffect(() => {
    if (initialQuery.data) {
      setPages([initialQuery.data.items as FeedPost[]]);
      setCursor(initialQuery.data.nextCursor);
      setHasMore(!!initialQuery.data.nextCursor);
    }
  }, [initialQuery.data]);

  const loadMore = useCallback(async () => {
    if (isLoadingPage || !hasMore || !cursor) return;
    setIsLoadingPage(true);
    try {
      const result = await trpcClient.posts.feed.query({
        limit: PAGE_SIZE,
        cursor,
      });
      setPages((prev) => [...prev, result.items as FeedPost[]]);
      setCursor(result.nextCursor);
      setHasMore(!!result.nextCursor);
    } finally {
      setIsLoadingPage(false);
    }
  }, [cursor, hasMore, isLoadingPage]);

  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [loadMore]);

  const allPosts = pages.flat();

  const handleRefresh = () => {
    setPages([]);
    setCursor(undefined);
    setHasMore(true);
    initialQuery.refetch();
  };

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
          <CreatePostDialog onPosted={handleRefresh} />
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
        posts={allPosts}
        isLoading={initialQuery.isLoading}
        onRefresh={handleRefresh}
        canModerate={role === "ADMIN"}
        viewMode={viewMode}
      />

      {/* Scroll sentinel + loading/end indicators */}
      <div ref={sentinelRef} className="py-2" />
      {isLoadingPage && (
        <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading more posts...
        </div>
      )}
      {!hasMore && allPosts.length > 0 && !isLoadingPage && (
        <p className="py-6 text-center text-xs text-muted-foreground">
          You've reached the end
        </p>
      )}

      {canPost && <CreatePostDialog onPosted={handleRefresh} floating />}
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

type FeedPost = {
  id: string;
  imageUrl: string;
  imageUrls?: string[];
  caption: string | null;
  createdAt: string;
  author: {
    name: string | null;
    image?: string | null;
  };
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
   comments?: Array<{
    id: string;
    content: string;
    createdAt: string;
    author: {
      name: string | null;
      image?: string | null;
    };
  }>;
};

type FeedProps = {
  posts: FeedPost[];
  isLoading: boolean;
  onRefresh: () => void;
  canModerate: boolean;
  viewMode: "list" | "grid";
};

const truncate = (value: string, max: number) =>
  value.length <= max ? value : `${value.slice(0, max - 1)}…`;

function Feed({ posts, isLoading, onRefresh, canModerate, viewMode }: FeedProps) {
  const deleteMutation = useMutation(
    trpc.posts.delete.mutationOptions({
      onSuccess: () => {
        onRefresh();
      },
    }),
  );
  const [likedPosts, setLikedPosts] = useState<Record<string, boolean>>({});
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [commentsPost, setCommentsPost] = useState<FeedPost | null>(null);

  const likeMutation = useMutation(
    trpc.posts.toggleLike.mutationOptions({
      onSuccess: (data, variables) => {
        setLikedPosts((prev) => ({
          ...prev,
          [variables.postId]: data.liked,
        }));
        setLikeCounts((prev) => ({
          ...prev,
          [variables.postId]: data.likeCount,
        }));
      },
    }),
  );

  const isLiked = (post: FeedPost) => likedPosts[post.id] ?? post.likedByMe;
  const getLikeCount = (post: FeedPost) => likeCounts[post.id] ?? post.likeCount;

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
              <PostImageCarousel
                images={post.imageUrls?.length ? post.imageUrls : [post.imageUrl]}
                alt={post.caption ?? "Post image"}
                className="relative h-full w-full"
              />
            </div>
            <div className="mt-2 flex items-center justify-between gap-1">
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2"
                  onClick={() => likeMutation.mutate({ postId: post.id })}
                >
                  <Heart className={`size-4 ${isLiked(post) ? "fill-current text-rose-500" : ""}`} />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2"
                  onClick={() => setCommentsPost(post)}
                >
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
            <div className="flex items-center gap-3">
              <div className="relative h-9 w-9 overflow-hidden rounded-full bg-muted">
                {post.author.image ? (
                  <img
                    src={resolveMediaUrl(post.author.image)}
                    alt={post.author.name ?? "User"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs font-medium text-muted-foreground">
                    {(post.author.name ?? "U").charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="space-y-0.5">
                <CardTitle className="text-sm font-semibold">
                  {post.author.name ?? "Unknown user"}
                </CardTitle>
                <CardDescription className="text-xs">
                  {formatPostDate(post.createdAt)}
                </CardDescription>
              </div>
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
              <PostImageCarousel
                images={post.imageUrls?.length ? post.imageUrls : [post.imageUrl]}
                alt={post.caption ?? "Post image"}
                className="relative h-full w-full"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="gap-2"
                onClick={() => likeMutation.mutate({ postId: post.id })}
              >
                <Heart className={`size-4 ${isLiked(post) ? "fill-current text-rose-500" : ""}`} />
                {isLiked(post) ? "Liked" : "Like"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="gap-2"
                onClick={() => setCommentsPost(post)}
              >
                <MessageCircle className="size-4" />
                Comment
              </Button>
            </div>
            <div className="text-xs text-muted-foreground">
              {getLikeCount(post)} {getLikeCount(post) === 1 ? "like" : "likes"} ·{" "}
              {post.commentCount === 0
                ? "No comments yet"
                : post.commentCount === 1
                  ? "1 comment"
                  : `${post.commentCount} comments`}
            </div>
            {post.caption && (
              <p className="text-sm text-foreground whitespace-pre-wrap">
                {post.caption}
              </p>
            )}
            {post.comments && post.comments.length > 0 && (
              <div className="space-y-1 pt-1 text-sm text-foreground">
                {post.comments.slice(0, 2).map((comment) => (
                  <p key={comment.id} className="overflow-hidden text-ellipsis">
                    <span className="mr-1 font-semibold">
                      {comment.author.name ?? "Unknown user"}:
                    </span>
                    <span>{truncate(comment.content, 120)}</span>
                  </p>
                ))}
                {post.commentCount > (post.comments?.length ?? 0) && (
                  <button
                    type="button"
                    className="text-xs font-medium text-primary hover:underline"
                    onClick={() => setCommentsPost(post)}
                  >
                    View all {post.commentCount} comments
                  </button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
      {commentsPost && (
        <CommentsDialog
          post={commentsPost}
          onClose={() => setCommentsPost(null)}
        />
      )}
    </div>
  );
}

type CommentsDialogProps = {
  post: FeedPost;
  onClose: () => void;
};

function CommentsDialog({ post, onClose }: CommentsDialogProps) {
  const [content, setContent] = useState("");
  const commentsQuery = useQuery(trpc.posts.getComments.queryOptions({ postId: post.id }));
  const addCommentMutation = useMutation(
    trpc.posts.addComment.mutationOptions({
      onSuccess: async () => {
        setContent("");
        await commentsQuery.refetch();
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!content.trim()) return;
    addCommentMutation.mutate({
      postId: post.id,
      content: content.trim(),
    });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogPopup className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Comments</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 p-4">
          <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
            {commentsQuery.isLoading ? (
              <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                <Loader2 className="mr-2 size-4 animate-spin" />
                Loading comments...
              </div>
            ) : commentsQuery.data && commentsQuery.data.length > 0 ? (
              commentsQuery.data.map((comment) => (
                <div key={comment.id} className="flex items-start gap-3 text-sm">
                  <div className="mt-0.5 h-7 w-7 overflow-hidden rounded-full bg-muted">
                    {comment.author.image ? (
                      <img
                        src={resolveMediaUrl(comment.author.image)}
                        alt={comment.author.name ?? "User"}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs font-medium text-muted-foreground">
                        {(comment.author.name ?? "U").charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold">
                      {comment.author.name ?? "Unknown user"}{" "}
                      <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                        {formatPostDate(comment.createdAt as string)}
                      </span>
                    </p>
                    <p className="text-sm whitespace-pre-wrap">
                      {comment.content}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-4 text-sm text-muted-foreground">
                No comments yet. Be the first to share your thoughts.
              </div>
            )}
          </div>
          <form onSubmit={handleSubmit} className="space-y-2 border-t border-border/60 pt-3">
            <Textarea
              rows={2}
              placeholder="Add a comment..."
              value={content}
              onChange={(event) => setContent(event.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                Close
              </Button>
              <Button type="submit" size="sm" disabled={addCommentMutation.isPending || !content.trim()}>
                {addCommentMutation.isPending ? "Posting..." : "Post"}
              </Button>
            </div>
          </form>
        </div>
      </DialogPopup>
    </Dialog>
  );
}

function PostComposer({ onPosted }: { onPosted: () => void }) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const filesRef = useRef<Array<{ id: string; file: File; previewUrl: string }>>([]);
  const [files, setFiles] = useState<Array<{ id: string; file: File; previewUrl: string }>>([]);
  const [caption, setCaption] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createMutation = useMutation(trpc.posts.create.mutationOptions());

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  useEffect(() => {
    return () => {
      for (const entry of filesRef.current) {
        URL.revokeObjectURL(entry.previewUrl);
      }
    };
  }, []);

  const handlePickFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    if (!selected.length) {
      return;
    }
    setFiles((prev) => {
      const remaining = 10 - prev.length;
      const additions = selected.slice(0, Math.max(remaining, 0)).map((file) => ({
        id: `${Date.now()}-${Math.random()}`,
        file,
        previewUrl: URL.createObjectURL(file),
      }));
      return [...prev, ...additions];
    });
    event.target.value = "";
  };

  const moveFile = (index: number, direction: "left" | "right") => {
    setFiles((prev) => {
      const target = direction === "left" ? index - 1 : index + 1;
      if (target < 0 || target >= prev.length) {
        return prev;
      }
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item as (typeof prev)[number]);
      return next;
    });
  };

  const removeFile = (id: string) => {
    setFiles((prev) => {
      const file = prev.find((entry) => entry.id === id);
      if (file) {
        URL.revokeObjectURL(file.previewUrl);
      }
      return prev.filter((entry) => entry.id !== id);
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!files.length) {
      return;
    }

    try {
      setIsSubmitting(true);
      const uploadedUrls: string[] = [];
      for (const entry of files) {
        const formData = new FormData();
        formData.append("file", entry.file);

        const response = await fetch(resolveMediaUrl("/upload") ?? "/upload", {
          method: "POST",
          body: formData,
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error("Upload failed");
        }

        const data = (await response.json()) as { imageUrl: string };
        uploadedUrls.push(data.imageUrl);
      }

      await createMutation.mutateAsync({
        imageUrls: uploadedUrls,
        imageUrl: uploadedUrls[0],
        caption: caption.trim() || undefined,
      });
      for (const entry of files) {
        URL.revokeObjectURL(entry.previewUrl);
      }
      setFiles([]);
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
        multiple
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
        {files.length ? `Add more images (${files.length}/10)` : "Choose images (up to 10)"}
      </Button>
      {files.length > 0 && (
        <div className="space-y-3">
          <div className="relative aspect-[4/5] w-full overflow-hidden rounded-xl bg-muted">
            <img
              src={files[0]?.previewUrl}
              alt="Cover preview"
              className="h-full w-full object-cover"
            />
            <p className="absolute left-2 top-2 rounded bg-black/50 px-2 py-1 text-xs text-white">
              Cover image
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {files.map((entry, index) => (
              <div key={entry.id} className="relative overflow-hidden rounded-lg border bg-muted p-1.5">
                <div className="aspect-square overflow-hidden rounded-md">
                  <img src={entry.previewUrl} alt={`Selected image ${index + 1}`} className="h-full w-full object-cover" />
                </div>
                <div className="mt-1 flex items-center justify-between gap-1">
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="outline"
                    onClick={() => moveFile(index, "left")}
                    disabled={index === 0}
                    aria-label="Move image left"
                  >
                    <ArrowLeft className="size-3.5" />
                  </Button>
                  <span className="text-xs text-muted-foreground">{index + 1}</span>
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="outline"
                    onClick={() => moveFile(index, "right")}
                    disabled={index === files.length - 1}
                    aria-label="Move image right"
                  >
                    <ArrowRight className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => removeFile(entry.id)}
                    aria-label="Remove image"
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
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
        disabled={!files.length || isSubmitting}
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
