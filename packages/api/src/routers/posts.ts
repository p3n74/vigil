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
    const userId = ctx.session?.user.id ?? null;

    const posts = await ctx.prisma.post.findMany({
      take: limit + 1,
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
        _count: {
          select: {
            likes: true,
            comments: true,
          },
        },
        ...(userId
          ? {
              likes: {
                where: { userId },
                select: { id: true },
              },
            }
          : {}),
        comments: {
          take: 2,
          orderBy: { createdAt: "asc" },
          include: {
            author: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
          },
        },
      },
    });

    const hasMore = posts.length > limit;
    const items = posts.slice(0, limit);
    const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;

    const mapped = items.map((post) => {
      const base = withFallbackImages(post);
      const likedByMe = userId ? base.likes?.length > 0 : false;
      const likeCount = base._count.likes;
      const commentCount = base._count.comments;
      const { likes, _count, ...rest } = base;
      return {
        ...rest,
        likeCount,
        commentCount,
        likedByMe,
      };
    });

    return {
      items: mapped,
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
        take: limit + 1,
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

  toggleLike: whitelistedProcedure
    .input(
      z.object({
        postId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const existing = await ctx.prisma.postLike.findUnique({
        where: {
          postId_userId: {
            postId: input.postId,
            userId,
          },
        },
      });

      if (existing) {
        await ctx.prisma.postLike.delete({
          where: { id: existing.id },
        });
      } else {
        await ctx.prisma.postLike.create({
          data: {
            postId: input.postId,
            userId,
          },
        });
      }

      const likeCount = await ctx.prisma.postLike.count({
        where: { postId: input.postId },
      });

      return {
        liked: !existing,
        likeCount,
      };
    }),

  addComment: whitelistedProcedure
    .input(
      z.object({
        postId: z.string(),
        content: z.string().min(1).max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const comment = await ctx.prisma.postComment.create({
        data: {
          postId: input.postId,
          authorId: userId,
          content: input.content.trim(),
        },
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

      return comment;
    }),

  getComments: whitelistedProcedure
    .input(
      z.object({
        postId: z.string(),
        limit: z.number().min(1).max(50).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const limit = input.limit ?? 20;

      const comments = await ctx.prisma.postComment.findMany({
        where: { postId: input.postId },
        orderBy: { createdAt: "asc" },
        take: limit,
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

      return comments;
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

