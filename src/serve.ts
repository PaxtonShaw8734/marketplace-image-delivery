import { createServer } from "node:http";
import { InfraiClient, prepareListingImage } from "./marketplace_image.ts";

const key = process.env.INFRAI_API_KEY;
if (!key) throw new Error("Set INFRAI_API_KEY before starting the service");
const client = new InfraiClient(key);

createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/listing-images") {
    response.writeHead(404).end(); return;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString());
    const result = await prepareListingImage(client, body, process.env.INFRAI_BUCKET ?? "marketplace-assets");
    response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(result));
  } catch (error) {
    response.writeHead(400, { "content-type": "application/json" }).end(JSON.stringify({ error: (error as Error).message }));
  }
}).listen(Number(process.env.PORT ?? 3000));
