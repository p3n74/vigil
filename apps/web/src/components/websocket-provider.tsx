import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Navigation } from "lucide-react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useGeolocation } from "@/hooks/useGeolocation";
import { authClient } from "@/lib/auth-client";
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export interface WsEventPayload {
  event: string;
  entityId?: string;
  action: string;
  timestamp: number;
  message?: string;
}

interface WebSocketContextValue {
  isConnected: boolean;
  lastEventTime: number | null;
  /** Last received event (e.g. for tab title "New message" when backgrounded) */
  lastEvent: WsEventPayload | null;
}

const WebSocketContext = createContext<WebSocketContextValue>({
  isConnected: false,
  lastEventTime: null,
  lastEvent: null,
});

export function useWebSocketContext() {
  return useContext(WebSocketContext);
}

interface WebSocketProviderProps {
  children: ReactNode;
}

/**
 * WebSocket provider that manages real-time connection based on auth state
 * 
 * This provider:
 * 1. Monitors auth state to get user ID
 * 2. Connects/disconnects WebSocket based on auth
 * 3. Joins user-specific room for targeted updates
 * 4. Provides connection status to children
 */
export function WebSocketProvider({ children }: WebSocketProviderProps) {
  const [userId, setUserId] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);

  // Get auth state
  useEffect(() => {
    let mounted = true;

    const checkAuth = async () => {
      try {
        const session = await authClient.getSession();
        if (mounted) {
          setUserId(session.data?.user?.id);
          setIsLoading(false);
        }
      } catch {
        if (mounted) {
          setUserId(undefined);
          setIsLoading(false);
        }
      }
    };

    checkAuth();

    // Subscribe to auth changes (listen may return an unsubscribe function or nothing)
    const unsubscribe = authClient.$store.listen?.("$sessionSignal", () => {
      checkAuth();
    });

    return () => {
      mounted = false;
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, []);

  // Track GPS position app-wide so heartbeats always include coords
  const geo = useGeolocation(!!userId);

  // Connect WebSocket with user context + location
  const { isConnected, lastEvent } = useWebSocket({
    userId,
    enabled: !isLoading,
    geoCoords: geo.coords,
  });

  const value: WebSocketContextValue = {
    isConnected,
    lastEventTime: lastEvent?.timestamp ?? null,
    lastEvent: lastEvent ?? null,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
      {geo.shouldPrompt && (
        <LocationPermissionDialog
          onAllow={geo.requestPermission}
          onDismiss={geo.dismissPrompt}
        />
      )}
    </WebSocketContext.Provider>
  );
}

function LocationPermissionDialog({
  onAllow,
  onDismiss,
}: {
  onAllow: () => void;
  onDismiss: () => void;
}) {
  const [open, setOpen] = useState(true);

  const handleAllow = () => {
    onAllow();
    setOpen(false);
  };

  const handleDismiss = () => {
    onDismiss();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleDismiss(); }}>
      <DialogPopup className="!max-w-xs" aria-describedby={undefined}>
        <DialogHeader className="items-center gap-3 sm:items-center sm:text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
            <Navigation className="size-5 text-primary" />
          </div>
          <DialogTitle className="text-base">Precise Location</DialogTitle>
          <DialogDescription className="sm:text-center">
            To optimize your preferences, allow precise location.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="mt-5 gap-2 sm:flex-col">
          <Button onClick={handleAllow} className="w-full">
            Allow
          </Button>
          <Button variant="ghost" onClick={handleDismiss} className="w-full text-muted-foreground">
            Not Now
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}

/**
 * Optional component to show WebSocket connection status
 * Can be placed in header or status bar
 */
export function WebSocketStatus() {
  const { isConnected } = useWebSocketContext();

  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span
        className={`h-2 w-2 rounded-full ${
          isConnected ? "bg-emerald-500" : "bg-amber-500"
        }`}
      />
      <span className="text-muted-foreground">
        {isConnected ? "Live" : "Connecting..."}
      </span>
    </div>
  );
}
