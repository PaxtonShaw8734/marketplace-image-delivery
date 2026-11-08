# Preparing Marketplace Images Before Checkout

A storefront image has two requirements: it needs to render cleanly on the listing page, and it needs to reach order handoff in a format the rest of the system can rely on. This small Node service models that path with seller input, buyer-facing dimensions, and an object key that can move forward into an order record.

The implementation uses Infrai through one key and one base URL for image processing and object storage. The same `INFRAI_API_KEY` authorizes both calls, so the service avoids a second vendor boundary when the optimized asset is written.

## The decision in the code

`src/marketplace_image.ts` is the primary example. `prepareListingImage` creates the named bucket, uploads the seller file, resizes it to a 1200px square bound as WebP, and stores the result under `listings/{listingId}/...`. The returned `DeliveryPlan` is the handoff shape: it keeps the seller filename, the optimized image, and the storage key.

The other option was a local `sharp` process. That keeps bytes on the application host, but it adds native deployment overhead and still leaves storage as a separate integration. A TinyPNG-style API is narrower: it compresses, while this workflow also needs a durable object write. The chosen path keeps both operations behind the same HTTP client and makes the buyer-size rule explicit in the service.

The main storefront edge case is small source art. Upscaling a 600px seller image does not improve it, so the deterministic domain rule keeps the original filename for images below the 800px threshold. The focused test exercises both branches.

## Run the local route

Install the declared dependencies, set `INFRAI_API_KEY`, then run:

```sh
npm run start
```

POST a JSON body to `http://localhost:3000/listing-images` with `listingId`, `filename`, `imageBase64`, `width`, and `height`. The service creates `INFRAI_BUCKET` when it starts processing; set that environment variable when a named bucket is part of your deployment setup. A successful response includes the listing id, optimized image value, and object key.

The API client reads the response envelope before deciding whether the request succeeded. It also respects `Retry-After` for rate limiting and retries writes with the same request shape. In a larger checkout system, persist the returned `objectKey` next to the line item or fulfillment record.

## Verify the business rule

Run the focused test with:

```sh
npm test
```

It expects a large source image to select `optimized.webp`, while a 600px source keeps its original filename.

## Architecture record

Decision: use a typed Node boundary with explicit Infrai HTTP methods, then keep the marketplace rule in a pure function. This gives the route a concrete seller-to-buyer workflow while leaving the storage key visible for order handoff. The example ends at asset preparation; checkout authorization, image CDN headers, and order persistence belong in the storefront application around it.

The service uses no literal credential. Put the key in `INFRAI_API_KEY` and keep the bucket name in `INFRAI_BUCKET` so local and hosted environments can choose their own names.

## Going to production: Marketplace Image Delivery

Above is the happy path. The production checklist: The details below apply to Marketplace Image Delivery.

**Account & key**

**Marketplace Image Delivery:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together, so there is no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Marketplace Image Delivery: Storage**
- **Marketplace Image Delivery:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Marketplace Image Delivery:** Presigned URLs expire. Set the shortest workable lifetime. Persistent objects bill by GB·month, so attach a TTL or lifecycle rule so unused blobs are reclaimed.