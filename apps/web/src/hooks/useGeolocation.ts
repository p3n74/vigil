import { useCallback, useEffect, useRef, useState } from "react";

export interface GeoCoords {
  lat: number;
  lng: number;
}

export type GeoPermission = "granted" | "denied" | "prompt" | "checking";

const PERMISSION_KEY = "vigil:geo-permission-asked";

/**
 * Watches the browser Geolocation API and exposes the latest coordinates.
 * Does NOT auto-trigger the browser prompt — waits until permission is already
 * "granted" or the caller explicitly invokes `requestPermission()`.
 */
export function useGeolocation(enabled = true) {
  const [coords, setCoords] = useState<GeoCoords | null>(null);
  const [permission, setPermission] = useState<GeoPermission>("checking");
  const watchIdRef = useRef<number | null>(null);

  // Check current permission state without triggering a prompt
  useEffect(() => {
    if (!enabled || !navigator.geolocation) {
      setPermission("denied");
      return;
    }

    if (!navigator.permissions?.query) {
      // Permissions API not supported — check localStorage fallback
      const asked = localStorage.getItem(PERMISSION_KEY);
      setPermission(asked === "granted" ? "granted" : asked === "denied" ? "denied" : "prompt");
      return;
    }

    let mounted = true;
    navigator.permissions.query({ name: "geolocation" }).then((status) => {
      if (!mounted) return;
      setPermission(status.state as GeoPermission);

      status.addEventListener("change", () => {
        if (mounted) setPermission(status.state as GeoPermission);
      });
    });

    return () => { mounted = false; };
  }, [enabled]);

  // Start watching only when permission is granted
  useEffect(() => {
    if (!enabled || permission !== "granted") return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => {
        console.warn("[Geo] watchPosition error:", err.message);
      },
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 15_000 },
    );

    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [enabled, permission]);

  // Explicitly request permission (triggers the native browser prompt)
  const requestPermission = useCallback(() => {
    if (!navigator.geolocation) {
      setPermission("denied");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPermission("granted");
        localStorage.setItem(PERMISSION_KEY, "granted");
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        setPermission("denied");
        localStorage.setItem(PERMISSION_KEY, "denied");
      },
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  }, []);

  // Whether we should show the in-app permission dialog
  const shouldPrompt =
    enabled &&
    permission === "prompt" &&
    localStorage.getItem(PERMISSION_KEY) !== "dismissed";

  const dismissPrompt = useCallback(() => {
    localStorage.setItem(PERMISSION_KEY, "dismissed");
  }, []);

  return { coords, permission, shouldPrompt, requestPermission, dismissPrompt };
}
