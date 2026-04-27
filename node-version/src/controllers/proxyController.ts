import http from "http";
import https from "https";
import { URL } from "url";
import type { Request, Response } from "express";
import { EDITOR_SCRIPT } from "../config/editorScript";
import { runtimeState } from "../state/runtimeState";

export function proxyToProject(req: Request, res: Response): void {
  const targetBase = `http://localhost:${runtimeState.devServerPort}`;
  const targetUrl = `${targetBase}${req.url}`;
  const parsedTarget = new URL(targetUrl);

  const isHttps = parsedTarget.protocol === "https:";
  const lib = isHttps ? https : http;

  const options: http.RequestOptions = {
    hostname: parsedTarget.hostname,
    port: parsedTarget.port || (isHttps ? 443 : 80),
    path: parsedTarget.pathname + parsedTarget.search,
    method: req.method,
    headers: {
      ...req.headers,
      host: parsedTarget.host,
    },
  };

  delete (options.headers as Record<string, string>)?.["content-length"];

  const proxyReq = lib.request(options, (proxyRes) => {
    const contentType = String(proxyRes.headers["content-type"] || "");
    const isHtml = contentType.includes("text/html");

    if (!isHtml) {
      res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
      proxyRes.pipe(res);
      return;
    }

    let body = "";
    proxyRes.setEncoding("utf-8");
    proxyRes.on("data", (chunk) => {
      body += chunk;
    });

    proxyRes.on("end", () => {
      if (body.includes("</body>")) {
        body = body.replace("</body>", `${EDITOR_SCRIPT}</body>`);
      }

      const responseHeaders = { ...proxyRes.headers };
      delete responseHeaders["content-length"];
      responseHeaders["content-type"] = "text/html; charset=utf-8";
      res.writeHead(proxyRes.statusCode || 200, responseHeaders);
      res.end(body);
    });
  });

  proxyReq.on("error", (err) => {
    if (!res.headersSent) {
      res.status(502).json({ error: `Proxy error: ${err.message}` });
    }
  });

  req.pipe(proxyReq);
}
