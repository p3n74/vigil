import { initTRPC, TRPCError } from "@trpc/server";

import type { Context } from "./context";

export const t = initTRPC.context<Context>().create();

export const router = t.router;

export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required",
      cause: "No session",
    });
  }
  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
    },
  });
});

/** Generic Admin Procedure: only users with ADMIN role in authorized_user table. */
export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.userRole !== "ADMIN") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have administrative access.",
    });
  }
  return next({ ctx });
});

/** Whitelist Procedure: users who have any role assigned. */
export const whitelistedProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.userRole == null) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Access restricted. You must be whitelisted to view this data.",
    });
  }
  return next({ ctx });
});
