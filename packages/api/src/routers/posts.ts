import { z } from "zod";
import { TRPCError } from "@trpc/server";

import { adminProcedure, protectedProcedure, router, whitelistedProcedure } from "../index";

const isAllowedImageUrl = (value: string) => {
  if (value.startsWith("/uploads/")) {
    return true;
  }
  return z.string().url().safeParse(value).success;
};

const IMAGE_URL_INPUT = z
  .string()
  .min(1)
  .refine(isAllowedImageUrl, "Image URL must be absolute or use /uploads/...");

const CREATE_POST_INPUT = z
  .object({
    imageUrl: IMAGE_URL_INPUT.optional(),
    imageUrls: z.array(IMAGE_URL_INPUT).min(1).max(10).optional(),
    caption: z.string().max(500).optional(),
  })
  .refine((value) => (value.imageUrls?.length ?? 0) > 0 || Boolean(value.imageUrl), {
    message: "At least one image is required.",
    path: ["imageUrls"],
  });

const FEED_INPUT = z
  .object({
    limit: z.number().min(1).max(50).optional(),
    cursor: z.string().optional(),
  })
  .optional();

const PROFILE_FEED_INPUT = z.object({
  userId: z.string(),
  limit: z.number().min(1).max(50).optional(),
  cursor: z.string().optional(),
});

const authorOrAdminProcedure = protectedProcedure.use(({ ctx, next }) => {
  const role = ctx.userRole;
  if (role !== "ADMIN" && role !== "AUTHOR") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have permission to create posts.",
    });
  }
  return next({ ctx });
});

const withFallbackImages = <T extends { imageUrl: string; imageUrls: string[] }>(post: T) => ({
  ...post,
  imageUrls: post.imageUrls.length ? post.imageUrls : [post.imageUrl],
});

export const postsRouter = router({
  feed: whitelistedProcedure.input(FEED_INPUT).query(async ({ ctx, input }) => {
    const limit = input?.limit ?? 20;
    const cursor = input?.cursor;

    const posts = await ctx.prisma.post.findMany({
      take: limit + (cursor ? 1 : 0),
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: {
        author: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    });

    const hasMore = posts.length > limit;
    const items = posts.slice(0, limit);
    const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;

    return {
      items: items.map(withFallbackImages),
      nextCursor,
    };
  }),

  byAuthor: whitelistedProcedure
    .input(PROFILE_FEED_INPUT)
    .query(async ({ ctx, input }) => {
      const limit = input.limit ?? 20;
      const cursor = input.cursor;

      const posts = await ctx.prisma.post.findMany({
        where: { authorId: input.userId },
        take: limit + (cursor ? 1 : 0),
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          imageUrl: true,
          imageUrls: true,
          caption: true,
          createdAt: true,
        },
      });

      const hasMore = posts.length > limit;
      const items = posts.slice(0, limit);
      const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;

      return {
        items: items.map(withFallbackImages),
        nextCursor,
      };
    }),

  create: authorOrAdminProcedure
    .input(CREATE_POST_INPUT)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const imageUrls = input.imageUrls?.length ? input.imageUrls : [input.imageUrl as string];

      const post = await ctx.prisma.post.create({
        data: {
          authorId: userId,
          imageUrl: imageUrls[0] as string,
          imageUrls,
          caption: input.caption,
        },
      });

      await ctx.prisma.activityLog.create({
        data: {
          userId,
          action: "created",
          entityType: "post",
          entityId: post.id,
          description: "created a new post",
        },
      });

      return post;
    }),

  delete: adminProcedure
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const post = await ctx.prisma.post.findUnique({
        where: { id: input.id },
      });

      if (!post) {
        return { success: true };
      }

      await ctx.prisma.post.delete({
        where: { id: input.id },
      });

      await ctx.prisma.activityLog.create({
        data: {
          userId: ctx.session.user.id,
          action: "deleted",
          entityType: "post",
          entityId: input.id,
          description: "deleted a post",
        },
      });

      return { success: true };
    }),
});

