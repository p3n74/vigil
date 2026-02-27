import { z } from "zod";
import { TRPCError } from "@trpc/server";

import { protectedProcedure, router, whitelistedProcedure } from "../index";

const isAllowedImageUrl = (value: string) => {
  if (value.startsWith("/uploads/")) {
    return true;
  }
  return z.string().url().safeParse(value).success;
};

export const userRouter = router({
  getMe: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const user = await ctx.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        displayName: true,
        email: true,
        image: true,
        bio: true,
        googleImage: true,
        customImage: true,
        avatarSource: true,
      },
    });

    if (!user) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    const googleImage = user.googleImage || ctx.session.user.image || null;
    const avatarSource = (user.avatarSource ?? "GOOGLE") as "GOOGLE" | "CUSTOM";
    const avatarUrl =
      avatarSource === "CUSTOM"
        ? user.customImage || user.image || googleImage || null
        : googleImage || user.image || null;

    return {
      ...user,
      googleImage,
      avatarSource,
      avatarUrl,
    };
  }),

  updateProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100).optional(),
        displayName: z.string().max(50).nullable().optional(),
        bio: z.string().max(1000).nullable().optional(),
        avatarMode: z.enum(["GOOGLE", "CUSTOM"]).optional(),
        customImageUrl: z
          .string()
          .min(1)
          .refine(isAllowedImageUrl, "Image URL must be absolute or use /uploads/...")
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const data: {
        name?: string;
        displayName?: string | null;
        bio?: string | null;
        googleImage?: string | null;
        customImage?: string | null;
        avatarSource?: string;
        image?: string | null;
      } = {};

      if (input.name !== undefined) {
        data.name = input.name.trim();
      }

      if (input.displayName !== undefined) {
        const trimmedDisplayName = input.displayName?.trim();
        data.displayName = trimmedDisplayName && trimmedDisplayName.length > 0 ? trimmedDisplayName : null;
      }

      if (input.bio !== undefined) {
        const trimmed = input.bio?.trim();
        data.bio = trimmed && trimmed.length > 0 ? trimmed : null;
      }

      if (input.avatarMode === "GOOGLE") {
        const existing = await ctx.prisma.user.findUnique({
          where: { id: userId },
          select: { googleImage: true, image: true },
        });

        const googleImage =
          existing?.googleImage ||
          ctx.session.user.image ||
          existing?.image ||
          null;

        if (googleImage) {
          data.googleImage = googleImage;
          data.customImage = null;
          data.avatarSource = "GOOGLE";
          data.image = googleImage;
        }
      } else if (input.avatarMode === "CUSTOM" && input.customImageUrl) {
        const existing = await ctx.prisma.user.findUnique({
          where: { id: userId },
          select: { googleImage: true, image: true },
        });

        const googleImage =
          existing?.googleImage ||
          ctx.session.user.image ||
          existing?.image ||
          null;

        data.googleImage = googleImage;
        data.customImage = input.customImageUrl;
        data.avatarSource = "CUSTOM";
        data.image = input.customImageUrl;
      }

      const updated = await ctx.prisma.user.update({
        where: { id: userId },
        data,
        select: {
          id: true,
          name: true,
          displayName: true,
          email: true,
          image: true,
          bio: true,
          googleImage: true,
          customImage: true,
          avatarSource: true,
        },
      });

      return updated;
    }),

  search: whitelistedProcedure
    .input(
      z.object({
        query: z.string().min(1).max(100),
        limit: z.number().min(1).max(20).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const limit = input.limit ?? 10;
      const term = input.query.trim();
      if (!term) return [];

      const users = await ctx.prisma.user.findMany({
        where: {
          OR: [
            { name: { contains: term, mode: "insensitive" } },
            { displayName: { contains: term, mode: "insensitive" } },
          ],
        },
        take: limit,
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          displayName: true,
          image: true,
          googleImage: true,
          customImage: true,
          avatarSource: true,
        },
      });

      return users.map((u) => {
        const avatarSource = (u.avatarSource ?? "GOOGLE") as "GOOGLE" | "CUSTOM";
        const avatarUrl =
          avatarSource === "CUSTOM"
            ? u.customImage || u.image || null
            : u.googleImage || u.image || null;
        return {
          id: u.id,
          name: u.name,
          displayName: u.displayName,
          avatarUrl,
        };
      });
    }),

  getById: whitelistedProcedure
    .input(
      z.object({
        userId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUnique({
        where: { id: input.userId },
        select: {
          id: true,
          name: true,
          displayName: true,
          image: true,
          bio: true,
          googleImage: true,
          customImage: true,
          avatarSource: true,
        },
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      const avatarSource = (user.avatarSource ?? "GOOGLE") as "GOOGLE" | "CUSTOM";
      const avatarUrl =
        avatarSource === "CUSTOM"
          ? user.customImage || user.image || null
          : user.googleImage || user.image || null;

      return {
        ...user,
        avatarSource,
        avatarUrl,
      };
    }),
});

