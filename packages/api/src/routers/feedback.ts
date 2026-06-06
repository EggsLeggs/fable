import { z } from "zod";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { randomUUID } from "node:crypto";
import { router, protectedProcedure } from "../trpc";
import { feedbackResponses } from "@fable/db";

export const feedbackRouter = router({
  hasSubmitted: protectedProcedure.query(async ({ ctx }) => {
    const existing = await ctx.db.query.feedbackResponses.findFirst({
      where: eq(feedbackResponses.userId, ctx.session.user.id),
    });
    return { submitted: !!existing };
  }),

  submit: protectedProcedure
    .input(
      z.object({
        platform: z.enum(["crowdin", "lokalise", "phrase", "other"]),
        otherPlatform: z.string().max(300).optional(),
        currentToolRating: z.number().int().min(1).max(5),
        likesCurrentTool: z.string().max(300),
        currentToolFrustration: z.string().max(300),
        fableRating: z.number().int().min(1).max(5),
        likesFable: z.string().max(300),
        dislikesFable: z.string().max(300),
        knownBugs: z.string().max(300),
        switchingIntent: z.enum(["yes", "maybe", "no"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.feedbackResponses.findFirst({
        where: eq(feedbackResponses.userId, ctx.session.user.id),
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "You have already submitted feedback.",
        });
      }

      const [response] = await ctx.db
        .insert(feedbackResponses)
        .values({
          id: randomUUID(),
          userId: ctx.session.user.id,
          platform: input.platform,
          otherPlatform: input.otherPlatform ?? null,
          currentToolRating: input.currentToolRating,
          likesCurrentTool: input.likesCurrentTool,
          currentToolFrustration: input.currentToolFrustration,
          fableRating: input.fableRating,
          likesFable: input.likesFable,
          dislikesFable: input.dislikesFable,
          knownBugs: input.knownBugs,
          switchingIntent: input.switchingIntent,
        })
        .returning();

      return response!;
    }),
});
