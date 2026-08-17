import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@forge/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: {
    // Credentials provider does not support database sessions in Auth.js
    // (the adapter's session-creation hook is only invoked for OAuth/Email
    // flows) — JWT is the correct strategy here, not a shortcut.
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = typeof credentials?.email === "string" ? credentials.email : undefined;
        const password = typeof credentials?.password === "string" ? credentials.password : undefined;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        const membership = await prisma.orgUser.findFirst({ where: { userId: user.id } });
        if (!membership) return null;

        return {
          id: user.id,
          email: user.email,
          orgId: membership.orgId,
          role: membership.role,
        };
      },
    }),
  ],
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
});
