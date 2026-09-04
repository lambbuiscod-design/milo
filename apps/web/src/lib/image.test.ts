import { describe, expect, it } from "vitest";
import { MAX_PROCESSED_IMAGE_BYTES, sanitizeImage, validateImageFile } from "@/lib/image";

describe("image validation", () => {
  it("accepts supported screenshot types", () => expect(validateImageFile(new File(["png"], "chat.png", { type: "image/png" }))).toBeNull());
  it("rejects unsupported files", () => expect(validateImageFile(new File(["text"], "chat.txt", { type: "text/plain" }))).toMatch(/PNG/));
  it("rejects files above the safe function-upload payload", () => expect(validateImageFile(new File([new Uint8Array(MAX_PROCESSED_IMAGE_BYTES + 1)], "chat.png", { type: "image/png" }))).toMatch(/prepared screenshot/i));
  it("rejects unsupported decoded content even when MIME claims PNG", async () => {
    const disguisedSvg = new File(
      ['<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400"/></svg>'],
      "chat.png",
      { type: "image/png" },
    );
    await expect(sanitizeImage(disguisedSvg)).rejects.toThrow(/contents do not match/i);
  });
});
