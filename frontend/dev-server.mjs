import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const args = new Map(
  process.argv.slice(2).flatMap((value, index, all) => {
    if (!value.startsWith("--")) {
      return [];
    }
    return [[value.slice(2), all[index + 1]]];
  }),
);

const port = Number(args.get("port") || process.env.FRONTEND_PORT || 5173);
const apiBaseUrl = args.get("api") || process.env.API_BASE_URL || "http://127.0.0.1:8000";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

function send(res, statusCode, body, headers = {}) {
  res.writeHead(statusCode, headers);
  res.end(body);
}

function safeStaticPath(urlPath) {
  const cleanPath = decodeURIComponent(urlPath.split("?")[0]);
  const requested = cleanPath === "/" ? "/index.html" : cleanPath;
  const filePath = path.resolve(root, `.${requested}`);
  if (!filePath.startsWith(root)) {
    return null;
  }
  return filePath;
}

async function proxyApi(req, res, url) {
  const target = new URL(url.pathname.replace(/^\/api/, "") + url.search, apiBaseUrl);
  const headers = { ...req.headers };
  delete headers.host;
  delete headers.connection;

  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body: req.method === "GET" || req.method === "HEAD" ? undefined : req,
      duplex: "half",
    });
    const body = Buffer.from(await upstream.arrayBuffer());
    const responseHeaders = Object.fromEntries(upstream.headers.entries());
    responseHeaders["content-length"] = String(body.length);
    send(res, upstream.status, body, responseHeaders);
  } catch (error) {
    send(
      res,
      502,
      JSON.stringify({
        error_code: "api_proxy_error",
        message: error.message,
      }),
      { "content-type": "application/json; charset=utf-8" },
    );
  }
}

async function serveStatic(req, res, url) {
  const filePath = safeStaticPath(url.pathname);
  if (!filePath || !existsSync(filePath) || statSync(filePath).isDirectory()) {
    send(res, 404, "Not found", { "content-type": "text/plain; charset=utf-8" });
    return;
  }

  const ext = path.extname(filePath);
  const contentType = mimeTypes[ext] || "application/octet-stream";

  if (path.basename(filePath) === "index.html") {
    const html = await readFile(filePath, "utf-8");
    const withConfig = html.replace(
      '<script type="module" src="./js/main.js"></script>',
      `<script>window.__APP_CONFIG__ = { API_BASE_URL: "/api" };</script>\n    <script type="module" src="./js/main.js"></script>`,
    );
    send(res, 200, withConfig, { "content-type": contentType });
    return;
  }

  res.writeHead(200, { "content-type": contentType });
  createReadStream(filePath).pipe(res);
}

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname.startsWith("/api/")) {
    proxyApi(req, res, url);
    return;
  }

  serveStatic(req, res, url);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Frontend dev server: http://127.0.0.1:${port}`);
  console.log(`Proxy target: ${apiBaseUrl}`);
});
