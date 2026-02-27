import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

import { authClient } from "@/lib/auth-client";
import { PostImageCarousel } from "@/components/post-image-carousel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NotWhitelistedView } from "@/components/not-whitelisted-view";
import { resolveMediaUrl } from "@/lib/media-url";
import { trpc } from "@/utils/trpc";

type ProfileSearch = {
  userId?: string;
};

export const Route = createFileRoute("/profile")({
  component: ProfileRoute,
  validateSearch: (search: Record<string, unknown>): ProfileSearch => {
    return {
      userId: typeof search.userId === "string" ? search.userId : undefined,
    };
  },
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

function ProfileRoute() {
  const { session } = Route.useRouteContext();
  const search = Route.useSearch();

  const myUserId = session.data?.user?.id;
  const targetUserId = search.userId ?? myUserId;

  const roleQueryOptions = trpc.team.getMyRole.queryOptions();
  const roleQuery = useQuery(roleQueryOptions);

  const profileQueryOptions = trpc.user.getById.queryOptions({
    userId: targetUserId!,
  });
  const postsQueryOptions = trpc.posts.byAuthor.queryOptions({
    userId: targetUserId!,
    limit: 30,
  });

  const enabled = !!targetUserId && roleQuery.isSuccess && (roleQuery.data?.role ?? null) !== null;

  const profileQuery = useQuery({
    ...profileQueryOptions,
    enabled,
  });
  const postsQuery = useQuery({
    ...postsQueryOptions,
    enabled,
  });

  const isWhitelisted = (roleQuery.data?.role ?? null) !== null;

  if (roleQuery.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isWhitelisted) {
    return <NotWhitelistedView />;
  }

  if (!targetUserId) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        Unable to determine profile.
      </div>
    );
  }

  if (profileQuery.isLoading || postsQuery.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!profileQuery.data) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        Profile not found.
      </div>
    );
  }

  const profile = profileQuery.data;
  const posts = postsQuery.data?.items ?? [];
  const isOwnProfile = myUserId === profile.id;
  const displayName = profile.displayName?.trim() ? profile.displayName : null;
  const realName = profile.name ?? "Unknown user";

  const avatarUrl =
    profile.avatarUrl ||
    (profile.avatarSource === "CUSTOM"
      ? profile.customImage || profile.image
      : profile.googleImage || profile.image);

  return (
    <div className="mx-auto flex w-full max-w-4xl min-w-0 flex-col gap-5 px-3 py-4 sm:gap-7 sm:px-4 sm:py-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="relative h-20 w-20 overflow-hidden rounded-full bg-muted sm:h-24 sm:w-24">
            {avatarUrl ? (
              <img
                src={resolveMediaUrl(avatarUrl)}
                alt={displayName ?? realName}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-muted-foreground">
                {(profile.name ?? "U").charAt(0)}
              </div>
            )}
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {displayName ?? realName}
            </h1>
            {displayName && (
              <p className="text-sm text-muted-foreground">
                {realName}
              </p>
            )}
            {profile.bio && (
              <p className="max-w-xl text-sm text-muted-foreground whitespace-pre-wrap">
                {profile.bio}
              </p>
            )}
          </div>
        </div>
        {isOwnProfile && (
          <div className="flex gap-2 sm:self-start">
            <Button
              variant="outline"
              onClick={() => {
                window.location.href = "/account";
              }}
            >
              Edit profile
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                window.location.href = "/";
              }}
            >
              New post
            </Button>
          </div>
        )}
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle>Posts</CardTitle>
            <CardDescription>
              {isOwnProfile
                ? "Photos you have shared to your Vigil feed."
                : "Photos shared by this user."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {posts.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground">
                {isOwnProfile
                  ? "No posts yet. Share a photo from home to get started."
                  : "No posts available for this user yet."}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
                {posts.map((post: { id: string; imageUrl: string; imageUrls?: string[]; caption: string | null }) => (
                  <div
                    key={post.id}
                    className="group relative aspect-square w-full overflow-hidden rounded-xl bg-muted"
                  >
                    <PostImageCarousel
                      images={post.imageUrls?.length ? post.imageUrls : [post.imageUrl]}
                      alt={post.caption ?? "Post image"}
                      className="relative h-full w-full transition-transform duration-200 group-hover:scale-105"
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

