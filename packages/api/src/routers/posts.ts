import { z } from "zod";
import { TRPCError } from "@trpc/server";

import { adminProcedure, protectedProcedure, router, whitelistedProcedure } from "../index";

const CREATE_POST_INPUT = z.object({
  imageUrl: z.string().url(),
  caption: z.string().max(500).optional(),
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
      items,
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
          caption: true,
          createdAt: true,
        },
      });

      const hasMore = posts.length > limit;
      const items = posts.slice(0, limit);
      const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;

      return {
        items,
        nextCursor,
      };
    }),

  create: authorOrAdminProcedure
    .input(CREATE_POST_INPUT)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const post = await ctx.prisma.post.create({
        data: {
          authorId: userId,
          imageUrl: input.imageUrl,
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

