import type { LocationEntry } from "../context";
import { router, whitelistedProcedure } from "../index";

export const locationRouter = router({
  getAll: whitelistedProcedure.query(async ({ ctx }) => {
    const liveLocations: Record<string, LocationEntry> = ctx.getLocationMap() as Record<string, LocationEntry>;
    const presenceMap: Record<string, string> = ctx.getPresenceMap() as Record<string, string>;
    const liveUserIds = Object.keys(liveLocations);

    const dbLocations: Array<{
      userId: string;
      latitude: number;
      longitude: number;
      updatedAt: Date;
      user: { id: string; name: string; image: string | null };
    }> = await (ctx.prisma.userLocation.findMany as Function)({
      where: liveUserIds.length > 0 ? { userId: { notIn: liveUserIds } } : {},
      include: {
        user: { select: { id: true, name: true, image: true } },
      },
    });

    const liveUsers: Array<{ id: string; name: string; image: string | null }> =
      liveUserIds.length > 0
        ? await (ctx.prisma.user.findMany as Function)({
            where: { id: { in: liveUserIds } },
            select: { id: true, name: true, image: true },
          })
        : [];

    const liveUserMap = new Map(liveUsers.map((u: { id: string; name: string; image: string | null }) => [u.id, u]));

    const results: Array<{
      userId: string;
      name: string;
      image: string | null;
      latitude: number;
      longitude: number;
      updatedAt: string;
      status: "online" | "away" | "offline";
    }> = [];

    for (const [userId, loc] of Object.entries(liveLocations)) {
      const user = liveUserMap.get(userId);
      if (!user) continue;
      results.push({
        userId,
        name: user.name,
        image: user.image,
        latitude: loc.latitude,
        longitude: loc.longitude,
        updatedAt: new Date(loc.updatedAt).toISOString(),
        status: (presenceMap[userId] as "online" | "away" | "offline") ?? "online",
      });
    }

    for (const row of dbLocations) {
      results.push({
        userId: row.userId,
        name: row.user.name,
        image: row.user.image,
        latitude: row.latitude,
        longitude: row.longitude,
        updatedAt: row.updatedAt.toISOString(),
        status: "offline",
      });
    }

    return { locations: results };
  }),
});
