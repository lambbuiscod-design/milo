import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MiloCat } from "../src/renderer/MiloCat";

describe("Milo layered customization", () => {
  it("renders an unlocked eye layer and head accessory", () => {
    const html = renderToString(
      <MiloCat
        state="idle"
        appearance={{
          fur: "mauve",
          eyes: "curious",
          accessories: { head: "coral-bow" },
          animationPersonality: "calm",
        }}
      />,
    );
    expect(html).toContain("milo-cat__eyes--curious");
    expect(html).toContain("milo-cat__accessory--coral-bow");
    expect(html).toContain("#7c6b7e");
  });

  it("does not render an accessory layer when none is selected", () => {
    const html = renderToString(
      <MiloCat
        state="idle"
        appearance={{ fur: "charcoal", eyes: "classic", accessories: {}, animationPersonality: "calm" }}
      />,
    );
    expect(html).toContain("milo-cat__eyes--normal");
    expect(html).not.toContain("milo-cat__accessory--coral-bow");
  });
});
