import "dotenv/config";
import http from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import worker from "./index.js";

const PORT = Number(process.env.PORT) || 4000;
const BASE = process.env.BASE_PATH ?? "";
const __dir = dirname(fileURLToPath(import.meta.url));

const STATIC = {
  "/": { file: "docs/index.html", mime: "text/html" },
  "/docs": { file: "docs/index.html", mime: "text/html" },
  "/style.css": { file: "docs/style.css", mime: "text/css" },
  "/reya-ani-mark.svg": { file: "docs/reya-ani-mark.svg", mime: "image/svg+xml" },
};

function serveStatic(res, entry) {
  try {
    const body = readFileSync(join(__dir, entry.file));
    res.writeHead(200, {
      "Content-Type": `${entry.mime}; charset=utf-8`,
      "Cache-Control": "no-cache",
    });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

async function nodeToRequest(req) {
  const host = req.headers["x-forwarded-host"] ?? req.headers.host ?? `localhost:${PORT}`;
  const protoHeader = req.headers["x-forwarded-proto"];
  const forwardedProto = Array.isArray(protoHeader) ? protoHeader[0] : protoHeader;
  const proto = process.env.PUBLIC_ORIGIN
    ? null
    : (forwardedProto || (req.headers["x-forwarded-ssl"] === "on" ? "https" : "http"));
  const origin = process.env.PUBLIC_ORIGIN || `${proto}://${host}`;
  const stripped = BASE && req.url.startsWith(BASE) ? req.url.slice(BASE.length) || "/" : req.url;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = chunks.length ? Buffer.concat(chunks) : null;

  return new Request(`${origin}${stripped}`, {
    method: req.method,
    headers: req.headers,
    body: body?.length ? body : undefined,
    duplex: "half",
  });
}

const server = http.createServer(async (req, res) => {
  console.log(`-> ${req.method} ${req.url}`);

  const pathname = req.url.split("?")[0];
  const staticEntry = STATIC[pathname];
  if (req.method === "GET" && staticEntry) return serveStatic(res, staticEntry);

  try {
    const request = await nodeToRequest(req);
    const response = await worker.fetch(request, {});
    res.statusCode = response.status;
    for (const [key, value] of response.headers) res.setHeader(key, value);
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    console.error("Unhandled request error:", error);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: error.message }));
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Reya Ani Extractor listening on port ${PORT}`);
});
