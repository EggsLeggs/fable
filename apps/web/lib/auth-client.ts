import { createAuthClient } from "better-auth/react";

function getAuthBaseURL() {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return "http://localhost:3000";
}

const authClient = createAuthClient({
  baseURL: getAuthBaseURL(),
});

export const { signIn, signUp, signOut, getSession, changePassword, deleteUser } = authClient;

export type SignUpEmailInput = {
  name: string;
  email: string;
  password: string;
  username: string;
};
