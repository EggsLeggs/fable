import { createAuthClient } from "better-auth/react";

const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
});

export const { signIn, signUp, signOut, getSession, changePassword, deleteUser } = authClient;

export type SignUpEmailInput = {
  name: string;
  email: string;
  password: string;
  username: string;
};
