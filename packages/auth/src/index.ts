import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { z } from "zod";
import { db, users, sessions, accounts, verifications } from "@fable/db";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user: users, session: sessions, account: accounts, verification: verifications },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  user: {
    deleteUser: {
      enabled: true,
    },
    additionalFields: {
      username: {
        type: "string",
        required: true,
        input: true,
        validator: {
          input: z
            .string()
            .min(3)
            .max(30)
            .regex(/^[a-z0-9_]+$/),
        },
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  trustedOrigins: process.env.TRUSTED_ORIGINS?.split(",") ?? [],
  secret: process.env.BETTER_AUTH_SECRET,
});

export type Session = typeof auth.$Infer.Session;
export type AuthUser = typeof auth.$Infer.Session.user;
