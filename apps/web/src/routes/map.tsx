import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  LocateFixed,
  MapPin,
  Users,
} from "lucide-react";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  InfoWindow,
  useMap,
} from "@vis.gl/react-google-maps";

import { authClient } from "@/lib/auth-client";
import { resolveMediaUrl } from "@/lib/media-url";
import { formatPostDate } from "@/lib/format-date";
import { env } from "@template/env/web";
import { trpc } from "@/utils/trpc";
import { useGeolocation } from "@/hooks/useGeolocation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/map")({
  component: MapPage,
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data) {
      throw redirect({ to: "/" });
    }
    return { session };
  },
});

const STATUS_RING: Record<string, string> = {
  online: "ring-emerald-500",
  away: "ring-amber-400",
  offline: "ring-zinc-400",
};

const STATUS_DOT: Record<string, string> = {
  online: "bg-emerald-500",
  away: "bg-amber-400",
  offline: "bg-zinc-400",
};

const STATUS_TEXT: Record<string, string> = {
  online: "text-emerald-500",
  away: "text-amber-400",
  offline: "text-muted-foreground",
};

const DEFAULT_CENTER = { lat: 37.7749, lng: -122.4194 };
const MAP_ID = "vigil-location-map";

interface UserLocation {
  userId: string;
  name: string;
  image: string | null;
  latitude: number;
  longitude: number;
  updatedAt: string;
  status: "online" | "away" | "offline";
}

function MapPage() {
  const roleQuery = useQuery(trpc.team.getMyRole.queryOptions());
  const isAdmin = roleQuery.data?.role === "ADMIN";

  if (roleQuery.isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-muted">
          <MapPin className="size-8 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground">Access restricted</p>
        <p className="text-xs text-muted-foreground">
          The map is currently only available to admins.
        </p>
      </div>
    );
  }

  const apiKey = env.VITE_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-muted">
          <MapPin className="size-8 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">
            Google Maps API key not configured
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Add{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
              VITE_GOOGLE_MAPS_API_KEY
            </code>{" "}
            to your environment to enable location tracking.
          </p>
        </div>
      </div>
    );
  }

  return (
    <APIProvider apiKey={apiKey}>
      <MapContent />
    </APIProvider>
  );
}

function MapContent() {
  const { session } = Route.useRouteContext();
  const myId = session.data?.user?.id;
  const { coords: myCoords } = useGeolocation(true);
  const hasCenteredRef = useRef(false);

  const locationsOptions = trpc.location.getAll.queryOptions();
  const { data, isLoading } = useQuery({
    ...locationsOptions,
    refetchInterval: 30_000,
  });

  const locations: UserLocation[] = (data?.locations ?? []) as UserLocation[];
  const onlineCount = locations.filter((l) => l.status === "online").length;
  const awayCount = locations.filter((l) => l.status === "away").length;
  const offlineCount = locations.filter((l) => l.status === "offline").length;

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const selectedUser = locations.find((l) => l.userId === selectedUserId);

  const map = useMap();

  const initialCenter = myCoords
    ? { lat: myCoords.lat, lng: myCoords.lng }
    : locations.length > 0
      ? { lat: locations[0].latitude, lng: locations[0].longitude }
      : DEFAULT_CENTER;

  // Center once on initial load
  useEffect(() => {
    if (map && !hasCenteredRef.current && (myCoords || locations.length > 0)) {
      const target = myCoords
        ? { lat: myCoords.lat, lng: myCoords.lng }
        : { lat: locations[0].latitude, lng: locations[0].longitude };
      map.panTo(target);
      hasCenteredRef.current = true;
    }
  }, [map, myCoords, locations.length]);

  const handleRecenter = useCallback(() => {
    if (!map) return;
    if (myCoords) {
      map.panTo({ lat: myCoords.lat, lng: myCoords.lng });
      map.setZoom(15);
    }
  }, [map, myCoords]);

  const handleFlyToUser = useCallback(
    (userId: string) => {
      const user = locations.find((l) => l.userId === userId);
      if (!map || !user) return;
      setSelectedUserId(userId);
      map.panTo({ lat: user.latitude, lng: user.longitude });
      map.setZoom(16);
    },
    [map, locations],
  );

  const handleMarkerClick = useCallback((userId: string) => {
    setSelectedUserId((prev) => (prev === userId ? null : userId));
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading map...</p>
      </div>
    );
  }

  return (
    <div className="relative flex h-full w-full overflow-hidden">
      {/* Sidebar — user list */}
      <div
        className={cn(
          "absolute left-0 top-0 z-10 flex h-full flex-col border-r border-border/40 bg-card/95 shadow-xl backdrop-blur-xl transition-all duration-300 md:relative",
          sidebarOpen
            ? "w-72 translate-x-0 lg:w-80"
            : "w-0 -translate-x-full md:translate-x-0",
        )}
      >
        {sidebarOpen && (
          <>
            {/* Sidebar header */}
            <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
              <div className="flex items-center gap-2">
                <Users className="size-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">People</h2>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                {onlineCount > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-emerald-500" />
                    {onlineCount}
                  </span>
                )}
                {awayCount > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-amber-400" />
                    {awayCount}
                  </span>
                )}
                {offlineCount > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-zinc-400" />
                    {offlineCount}
                  </span>
                )}
              </div>
            </div>

            {/* User list */}
            <div className="flex-1 overflow-y-auto">
              {locations.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
                  <MapPin className="size-8 opacity-30 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">
                    No locations shared yet
                  </p>
                </div>
              ) : (
                <ul className="py-1">
                  {/* Sort: online first, then away, then offline */}
                  {[...locations]
                    .sort((a, b) => {
                      const order = { online: 0, away: 1, offline: 2 };
                      return order[a.status] - order[b.status];
                    })
                    .map((loc) => (
                      <li key={loc.userId}>
                        <button
                          type="button"
                          onClick={() => handleFlyToUser(loc.userId)}
                          className={cn(
                            "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors",
                            selectedUserId === loc.userId
                              ? "bg-muted"
                              : "hover:bg-muted/50",
                          )}
                        >
                          <div className="relative shrink-0">
                            {loc.image ? (
                              <img
                                src={resolveMediaUrl(loc.image)}
                                alt=""
                                className={cn(
                                  "size-9 rounded-full object-cover ring-2",
                                  STATUS_RING[loc.status],
                                )}
                              />
                            ) : (
                              <div
                                className={cn(
                                  "flex size-9 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary ring-2",
                                  STATUS_RING[loc.status],
                                )}
                              >
                                {loc.name.charAt(0)}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {loc.userId === myId ? "You" : loc.name}
                            </p>
                            <p
                              className={cn(
                                "text-[11px] capitalize",
                                STATUS_TEXT[loc.status],
                              )}
                            >
                              {loc.status === "offline"
                                ? `Last seen ${formatPostDate(loc.updatedAt)}`
                                : loc.status}
                            </p>
                          </div>
                        </button>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>

      {/* Sidebar toggle */}
      <button
        type="button"
        onClick={() => setSidebarOpen((v) => !v)}
        className={cn(
          "absolute top-3 z-20 flex size-8 items-center justify-center rounded-r-lg border border-l-0 border-border/60 bg-card/95 shadow-md backdrop-blur-sm transition-all duration-300 hover:bg-muted",
          sidebarOpen ? "left-72 lg:left-80" : "left-0 rounded-l-lg border-l",
        )}
      >
        {sidebarOpen ? (
          <ChevronLeft className="size-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-4 text-muted-foreground" />
        )}
      </button>

      {/* Map */}
      <div className="relative min-w-0 flex-1">
        <Map
          mapId={MAP_ID}
          defaultCenter={initialCenter}
          defaultZoom={14}
          gestureHandling="greedy"
          disableDefaultUI={false}
          className="h-full w-full"
        >
          {locations.map((loc) => (
            <AdvancedMarker
              key={loc.userId}
              position={{ lat: loc.latitude, lng: loc.longitude }}
              onClick={() => handleMarkerClick(loc.userId)}
            >
              <UserPin
                name={loc.name}
                image={loc.image}
                status={loc.status}
                isMe={loc.userId === myId}
              />
            </AdvancedMarker>
          ))}

          {selectedUser && (
            <InfoWindow
              position={{
                lat: selectedUser.latitude,
                lng: selectedUser.longitude,
              }}
              onCloseClick={() => setSelectedUserId(null)}
              pixelOffset={[0, -52]}
            >
              <InfoWindowContent
                user={selectedUser}
                isMe={selectedUser.userId === myId}
              />
            </InfoWindow>
          )}
        </Map>

        {/* Recenter button */}
        {myCoords && (
          <Button
            variant="outline"
            size="icon"
            onClick={handleRecenter}
            className="absolute bottom-6 right-3 z-10 size-10 rounded-full border-border/60 bg-card/95 shadow-lg backdrop-blur-sm hover:bg-muted sm:right-6"
            title="Center on my location"
          >
            <LocateFixed className="size-4" />
          </Button>
        )}

        {/* Empty overlay when no locations */}
        {locations.length === 0 && !isLoading && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <div className="pointer-events-auto glass flex flex-col items-center gap-3 rounded-2xl px-8 py-6 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                <MapPin className="size-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">
                No locations yet
              </p>
              <p className="max-w-[200px] text-xs text-muted-foreground">
                Locations will appear as people open the app and share their
                position.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** InfoWindow renders inside Google Maps' own DOM, so theme CSS vars don't apply. Use inline styles. */
function InfoWindowContent({
  user,
  isMe,
}: {
  user: UserLocation;
  isMe: boolean;
}) {
  const statusLabel =
    user.status === "offline"
      ? `Last seen ${formatPostDate(user.updatedAt)}`
      : user.status.charAt(0).toUpperCase() + user.status.slice(1);

  const statusColor =
    user.status === "online"
      ? "#10b981"
      : user.status === "away"
        ? "#fbbf24"
        : "#9ca3af";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 2 }}>
      {user.image ? (
        <img
          src={resolveMediaUrl(user.image)}
          alt=""
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            objectFit: "cover",
            border: `2px solid ${statusColor}`,
          }}
        />
      ) : (
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#e5e7eb",
            fontWeight: 600,
            fontSize: 14,
            color: "#374151",
            border: `2px solid ${statusColor}`,
          }}
        >
          {user.name.charAt(0)}
        </div>
      )}
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontWeight: 600,
            fontSize: 13,
            color: "#111827",
            whiteSpace: "nowrap",
          }}
        >
          {isMe ? "You" : user.name}
        </div>
        <div
          style={{
            fontSize: 11,
            color: statusColor,
            marginTop: 1,
            fontWeight: 500,
          }}
        >
          {statusLabel}
        </div>
      </div>
    </div>
  );
}

function UserPin({
  name,
  image,
  status,
  isMe,
}: {
  name: string;
  image: string | null;
  status: string;
  isMe: boolean;
}) {
  const isOnline = status === "online";

  return (
    <div className="relative flex flex-col items-center" style={{ cursor: "pointer" }}>
      {/* Pulse ring for online users */}
      {isOnline && (
        <span
          className="absolute left-1/2 top-0 -translate-x-1/2"
          style={{ width: 44, height: 44 }}
        >
          <span className="absolute inset-0 animate-ping rounded-full bg-emerald-500/30" />
        </span>
      )}

      <div
        className={cn(
          "relative flex size-11 items-center justify-center rounded-full border-[2.5px] shadow-lg transition-transform duration-150 hover:scale-110",
          isMe
            ? "border-primary shadow-primary/20"
            : status === "online"
              ? "border-emerald-500"
              : status === "away"
                ? "border-amber-400"
                : "border-zinc-400",
        )}
      >
        {image ? (
          <img
            src={resolveMediaUrl(image)}
            alt={name}
            className="size-full rounded-full object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center rounded-full bg-muted text-xs font-bold text-foreground">
            {name.charAt(0)}
          </div>
        )}

        {/* Status dot */}
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full border-[2px] border-white dark:border-zinc-900",
            STATUS_DOT[status] ?? STATUS_DOT.offline,
          )}
        />
      </div>

      {/* Name tag */}
      <span
        className="mt-1.5 max-w-[84px] truncate rounded-full px-2 py-0.5 text-center text-[10px] font-semibold leading-tight shadow-sm"
        style={{
          background: "rgba(0,0,0,0.7)",
          color: "#fff",
          backdropFilter: "blur(4px)",
        }}
      >
        {isMe ? "You" : name.split(" ")[0]}
      </span>
    </div>
  );
}
