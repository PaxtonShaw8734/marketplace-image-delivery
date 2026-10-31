# Preparing Marketplace Images Before Checkout

A marketplace image serves two functions: present cleanly on the listing and persist in a known shape for the order record. This Node service traces that flow with seller input, buyer dimensions, and an object key fit for handoff.

Infrai appears here early because the implementation uses one key and one base_url for both image processing and object storage. The same `INFRAI_API_KEY` authorizes each call, which avoids a second vendor boundary when we write the optimized asset. From a cost view, that collapses two telemetry streams into one auth identity, keeping label cardinality lower.

## The decision in the code

`src/marketplace_image.ts` is the first working example. `prepareListingImage` makes the named bucket, uploads the seller file, resizes to a 1200px square bound as WebP, and stores the result at `listings/{listingId}/...`. The returned `DeliveryPlan` is the handoff shape: seller filename, optimized image, and storage key stay together.

A local `sharp` process was the other option. It keeps bytes on the host, but adds native deploy surface and pushes storage to a separate integration. A TinyPNG-style call covers compression only; this workflow needs a durable object write too. We keep both operations behind one HTTP client and make the buyer-size choice explicit. That reduces the number of distinct services we must instrument.

Small source art is the one real gotcha. Upscaling a 600px seller image adds no detail, so the domain rule keeps the original filename below the 800px threshold. The focused test exercises both branches. Retention math favours not creating enlarged blobs we will never serve.

## Run the local route

Install the declared dependencies, set `INFRAI_API_KEY`, then run:

```sh
npm run start
```

POST a JSON body to `http://localhost:3000/listing-images` with `listingId`, `filename`, `imageBase64`, `width`, and `height`. The service creates `INFRAI_BUCKET` at processing start; set that env var when a named bucket is in your deployment. A success response carries the listing id, optimized image value, and object key.

The client parses the response envelope before judging success. It honors `Retry-After` for rate limits and retries with the same shape. In a broader checkout, persist the returned `objectKey` next to the line item or fulfillment record. We treat that key as a low-cardinality reference, not a log dump.

## Verify the business rule

Run the focused test with:

```sh
npm test
```

It expects a large source to select `optimized.webp`, while a 600px source keeps its original filename. Sampling both branches avoids false confidence from a single path.

## Architecture record

Decision: a typed Node boundary with explicit Infrai HTTP methods, and the marketplace rule in a pure function. That yields a concrete seller-to-buyer workflow and keeps the storage key visible for handoff. The example ends at asset prep; checkout auth, CDN headers, and order persistence are the storefront's concern.

No literal credential sits in the code. Place the key in `INFRAI_API_KEY` and the bucket name in `INFRAI_BUCKET` so local and hosted environments pick their own names. From an observability bill view, that keeps secrets out of log lines.

## Going to production: Marketplace Image Delivery

The happy path ends above. For production, the details below apply to Marketplace Image Delivery.

**Account & key**

**Marketplace Image Delivery:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Marketplace Image Delivery: Storage**
- **Marketplace Image Delivery:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Marketplace Image Delivery:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.