import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Loader2, ImageIcon } from "lucide-react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/account")({
  component: AccountRoute,
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

function AccountRoute() {
  const { session } = Route.useRouteContext();
  const navigate = useNavigate();

  const profileQueryOptions = trpc.user.getMe.queryOptions();
  const profileQuery = useQuery(profileQueryOptions);

  const updateProfileMutation = useMutation(
    trpc.user.updateProfile.mutationOptions({
      onSuccess: () => {
        toast.success("Profile updated");
        profileQuery.refetch();
      },
      onError: (err) => {
        toast.error(err.message);
      },
    }),
  );

  if (profileQuery.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!profileQuery.data) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        Failed to load profile.
      </div>
    );
  }

  return (
    <AccountForm
      sessionEmail={session.data?.user?.email ?? ""}
      profile={profileQuery.data}
      onSaved={profileQuery.refetch}
      updateProfile={updateProfileMutation}
      onBack={() => navigate({ to: "/profile" })}
    />
  );
}

type ProfileData = Awaited<ReturnType<ReturnType<typeof trpc.user.getMe.queryOptions>["queryFn"]>>;

type AccountFormProps = {
  sessionEmail: string;
  profile: ProfileData;
  onSaved: () => void;
  updateProfile: ReturnType<typeof useMutation<typeof trpc.user.updateProfile.mutationOptions>>;
  onBack: () => void;
};

function AccountForm({ sessionEmail, profile, updateProfile, onBack }: AccountFormProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [displayName, setDisplayName] = useState(profile.displayName ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [avatarMode, setAvatarMode] = useState<"GOOGLE" | "CUSTOM">(
    profile.avatarSource === "CUSTOM" ? "CUSTOM" : "GOOGLE",
  );
  const [customImageUrl, setCustomImageUrl] = useState<string | null>(
    profile.customImage ?? null,
  );
  const [isUploading, setIsUploading] = useState(false);

  const effectiveAvatar =
    avatarMode === "CUSTOM"
      ? customImageUrl || profile.customImage || profile.image
      : profile.googleImage || profile.image;

  const handlePickFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
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
      setCustomImageUrl(data.imageUrl);
      setAvatarMode("CUSTOM");
    } catch (error) {
      toast.error((error as Error).message || "Failed to upload image");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    updateProfile.mutate({
      displayName,
      bio,
      avatarMode,
      customImageUrl: avatarMode === "CUSTOM" ? customImageUrl ?? undefined : undefined,
    });
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl min-w-0 flex-col gap-4 px-3 py-4 sm:gap-6 sm:px-4 sm:py-6">
      <div>
        <Button type="button" variant="outline" size="sm" onClick={onBack}>
          Back
        </Button>
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-xs font-medium uppercase tracking-widest text-primary">Account</p>
        <h1 className="text-3xl font-bold tracking-tight">Your profile</h1>
        <p className="text-muted-foreground">
          Signed in as {sessionEmail}.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Update your bio and profile picture.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="flex items-center gap-4">
              <div className="relative h-16 w-16 overflow-hidden rounded-full bg-muted">
                {effectiveAvatar ? (
                  <img
                    src={effectiveAvatar}
                    alt="Profile"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
                    <ImageIcon className="size-6" />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className={`rounded-full border px-3 py-1 text-xs ${
                      avatarMode === "GOOGLE"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground"
                    }`}
                    onClick={() => setAvatarMode("GOOGLE")}
                  >
                    Use Google photo
                  </button>
                  <button
                    type="button"
                    className={`rounded-full border px-3 py-1 text-xs ${
                      avatarMode === "CUSTOM"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground"
                    }`}
                    onClick={() => setAvatarMode("CUSTOM")}
                  >
                    Upload custom
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Choose between your Google profile picture or a custom upload.
                </p>
              </div>
            </div>

            {avatarMode === "CUSTOM" && (
              <div className="space-y-2">
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
                  className="justify-center gap-2"
                  onClick={handlePickFile}
                  disabled={isUploading}
                >
                  <ImageIcon className="size-4" />
                  {isUploading ? "Uploading..." : customImageUrl ? "Change image" : "Choose image"}
                </Button>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Display name</label>
              <Input
                placeholder="How people should see your name..."
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                maxLength={50}
              />
              <p className="text-xs text-muted-foreground">
                This does not change your Google full name.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Bio</label>
              <Textarea
                placeholder="Tell people a bit about yourself..."
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                This bio may be shown next to your posts or profile in the future.
              </p>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={updateProfile.isPending || isUploading}>
                {updateProfile.isPending ? "Saving..." : "Save changes"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

