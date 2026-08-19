import type { NextAuthConfig } from "next-auth";

// Edge-safe subset of the auth config: no providers, no bcrypt, no Prisma.
// Used by middleware (which runs in the Edge Runtime on Vercel) to verify
// an existing JWT for route protection. The full config with the
// Credentials provider lives in auth.ts and only runs in the Node.js
// runtime (the /api/auth route handler), where bcrypt/Prisma are fine.
export const authConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.orgId = user.orgId;
        token.role = user.role;
      }
      return token;
    },
    session: async ({ session, token }) => {
      session.user.id = token.sub ?? "";
      session.user.orgId = token.orgId;
      session.user.role = token.role;
      return session;
    },
  },
} satisfies NextAuthConfig;
