import type { OrgRole } from "@forge/db";
import type { DefaultSession } from "@auth/core/types";

// next-auth v5 re-exports its core types from @auth/core rather than
// declaring them itself — augmenting "next-auth"/"next-auth/jwt" doesn't
// merge with the real interfaces (they're re-exports, not declarations).
// The augmentation has to target @auth/core/types and @auth/core/jwt.
declare module "@auth/core/types" {
  interface Session {
    user: {
      id: string;
      orgId: string;
      role: OrgRole;
    } & DefaultSession["user"];
  }

  interface User {
    orgId: string;
    role: OrgRole;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    orgId: string;
    role: OrgRole;
  }
}
