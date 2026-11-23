import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Protects server functions from cross-site requests while supporting TLS-terminating reverse proxies.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
  origin: (origin, ctx) => {
    try {
      const originUrl = new URL(origin);
      const reqUrl = new URL(ctx.request.url);
      if (origin === reqUrl.origin) return true;
      const forwardedHost =
        ctx.request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
        ctx.request.headers.get("host")?.split(",")[0]?.trim();
      if (!forwardedHost) return false;
      const forwardedProto =
        ctx.request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase() ||
        (originUrl.protocol === "https:" ? "https" : "http");
      return origin === `${forwardedProto}://${forwardedHost}`;
    } catch {
      return false;
    }
  },
});

export const startInstance = createStart(() => ({
  functionMiddleware: [],
  requestMiddleware: [errorMiddleware, csrfMiddleware],
}));
