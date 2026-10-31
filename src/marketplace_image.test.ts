import assert from "node:assert/strict";
import { chooseListingAsset } from "./marketplace_image.ts";

const plan = chooseListingAsset({ listingId: "shoe-42", filename: "front.jpg", imageBase64: "data", width: 1600, height: 1200 }, "optimized.webp", "listings/shoe-42/front.jpg.webp");
assert.equal(plan.optimized, "optimized.webp");
assert.equal(plan.objectKey, "listings/shoe-42/front.jpg.webp");
assert.equal(chooseListingAsset({ listingId: "small", filename: "small.jpg", imageBase64: "data", width: 600, height: 600 }, "optimized.webp", "small").optimized, "small.jpg");
console.log("listing asset decision passed");
