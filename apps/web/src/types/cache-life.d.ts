// Type definitions for Next.js cacheLife configs

declare module "next/cache" {
  export { unstable_cache } from "next/dist/server/web/spec-extension/unstable-cache";
  export {
    updateTag,
    revalidateTag,
    revalidatePath,
    refresh,
  } from "next/dist/server/web/spec-extension/revalidate";
  export { unstable_noStore } from "next/dist/server/web/spec-extension/unstable-no-store";

  /**
   * Cache this `"use cache"` for a timespan defined by the `"default"` profile.
   */
  export function cacheLife(profile: "default"): void;

  /**
   * Cache this `"use cache"` for a timespan defined by the `"seconds"` profile.
   */
  export function cacheLife(profile: "seconds"): void;

  /**
   * Cache this `"use cache"` for a timespan defined by the `"minutes"` profile.
   */
  export function cacheLife(profile: "minutes"): void;

  /**
   * Cache this `"use cache"` for a timespan defined by the `"hours"` profile.
   */
  export function cacheLife(profile: "hours"): void;

  /**
   * Cache this `"use cache"` for a timespan defined by the `"days"` profile.
   */
  export function cacheLife(profile: "days"): void;

  /**
   * Cache this `"use cache"` for a timespan defined by the `"weeks"` profile.
   */
  export function cacheLife(profile: "weeks"): void;

  /**
   * Cache this `"use cache"` for a timespan defined by the `"max"` profile.
   */
  export function cacheLife(profile: "max"): void;

  /**
   * Cache this `"use cache"` using a custom timespan.
   */
  export function cacheLife(profile: {
    stale?: number;
    revalidate?: number;
    expire?: number;
  }): void;

  import { cacheTag } from "next/dist/server/use-cache/cache-tag";
  export { cacheTag };

  export const unstable_cacheTag: typeof cacheTag;
  export const unstable_cacheLife: typeof cacheLife;
}
