/**
 * Edge-compatible NextAuth configuration.
 *
 * This file must NOT import any Node.js-only modules (ioredis, bcrypt,
 * Prisma, etc.) because it is imported by middleware which runs in the
 * Edge Runtime. Providers that require Node.js are added in auth.ts.
 */
export const authConfig = {
    trustHost: true,
    pages: {
        signIn: '/login',
    },
    callbacks: {
        jwt({ token, user }) {
            if (user?.id)
                token.id = user.id;
            return token;
        },
        session({ session, token }) {
            if (session.user && token.id) {
                session.user.id = token.id;
            }
            return session;
        },
    },
    // Providers requiring Node.js modules (bcrypt, Prisma, ioredis) are
    // registered in auth.ts — not here. This list intentionally stays empty.
    providers: [],
};
