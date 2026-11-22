import { createMiddleware } from "@tanstack/react-start";

export const requireAdminAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const { resolveAuthenticatedSession } = await import("./auth-session.server");
  const me = await resolveAuthenticatedSession();
  if (!me) {
    throw new Error("Unauthorized: Administrator sign-in is required.");
  }
  return next({
    context: {
      me,
      userId: me.user.id,
      roles: me.roles,
    },
  });
});
