import type { Express } from "express";
import type { Server } from "http";
import { createProxyMiddleware, fixRequestBody } from "http-proxy-middleware";

export async function registerRoutes(app: Express): Promise<Server> {
  // Proxy all /api requests to FastAPI backend on port 8000
  app.use(
    "/api",
    createProxyMiddleware({
      target: "http://localhost:8000",
      changeOrigin: true,
      pathRewrite: { "^/api": "" },
      on: {
        proxyReq: fixRequestBody,
        error: (err: any, req: any, res: any) => {
          console.error("Proxy error:", err.message);
          res.status(502).json({ error: "Backend unavailable" });
        },
      },
    })
  );

  const { createServer } = await import("http");
  const server = createServer(app);
  return server;
}
