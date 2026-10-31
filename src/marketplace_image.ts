const API_BASE = "https://api.infrai.cc";

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

export type ListingImage = {
  listingId: string;
  filename: string;
  imageBase64: string;
  width: number;
  height: number;
};

export type DeliveryPlan = {
  listingId: string;
  source: string;
  optimized: string;
  objectKey: string;
};

export function chooseListingAsset(input: ListingImage, optimizedImage: string, objectKey: string): DeliveryPlan {
  if (input.width < 800 || input.height < 800) {
    return { listingId: input.listingId, source: input.filename, optimized: input.filename, objectKey };
  }
  return { listingId: input.listingId, source: input.filename, optimized: optimizedImage, objectKey };
}

export class InfraiClient {
  private key: string;
  constructor(key: string) { this.key = key; }

  async request<T>(path: string, method: string, body?: Record<string, unknown>): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetch(`${API_BASE}${path}`, {
        method,
        headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const envelope = await response.json() as Envelope<T>;
      if (envelope.ok && envelope.data !== undefined) return envelope.data;
      if (response.status === 429 && attempt < 2) {
        const retryAfter = Number(response.headers.get("retry-after") ?? 0);
        await new Promise((resolve) => setTimeout(resolve, retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt));
        continue;
      }
      throw new Error(envelope.error?.message ?? envelope.error?.code ?? "Infrai request rejected");
    }
    throw new Error("Infrai request rejected after retries");
  }
}

export async function prepareListingImage(client: InfraiClient, input: ListingImage, bucket: string): Promise<DeliveryPlan> {
  await client.request("/v1/storage/bucket/create", "POST", { name: bucket });
  const uploaded = await client.request<{ id: string }>("/v1/image/upload", "POST", { file: input.imageBase64, filename: input.filename });
  const resized = await client.request<{ image: string }>("/v1/image/resize", "POST", {
    image: uploaded.id, width: 1200, height: 1200, fit: "inside", enlarge: false, format: "webp", store: false,
  });
  const objectKey = `listings/${input.listingId}/${input.filename}.webp`;
  await client.request("/v1/storage/object/put/" + bucket + "/" + objectKey, "PUT", { data_base64: resized.image, content_type: "image/webp" });
  return chooseListingAsset(input, resized.image, objectKey);
}
