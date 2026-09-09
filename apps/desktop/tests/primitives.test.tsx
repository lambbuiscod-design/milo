import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  Button,
  Card,
  Container,
  SectionGroup,
  Stack,
} from "../src/renderer/components/primitives";

describe("UI Primitives (apps/desktop/src/renderer/components/primitives)", () => {
  describe("Button", () => {
    it("renders default primary variant and md size", () => {
      const html = renderToString(<Button>Click Milo</Button>);
      expect(html).toContain("milo-btn");
      expect(html).toContain("milo-btn--primary");
      expect(html).toContain("milo-btn--md");
      expect(html).toContain("Click Milo");
      expect(html).toContain('type="button"');
    });

    it("renders variants: secondary, ghost, danger", () => {
      const secHtml = renderToString(<Button variant="secondary">Cancel</Button>);
      expect(secHtml).toContain("milo-btn--secondary");

      const ghostHtml = renderToString(<Button variant="ghost">Dismiss</Button>);
      expect(ghostHtml).toContain("milo-btn--ghost");

      const dangerHtml = renderToString(<Button variant="danger">Delete</Button>);
      expect(dangerHtml).toContain("milo-btn--danger");
    });

    it("renders sizes: sm, md, lg", () => {
      const smHtml = renderToString(<Button size="sm">Small</Button>);
      expect(smHtml).toContain("milo-btn--sm");

      const lgHtml = renderToString(<Button size="lg">Large</Button>);
      expect(lgHtml).toContain("milo-btn--lg");
    });

    it("supports fullWidth and custom className", () => {
      const html = renderToString(<Button fullWidth className="extra-class">Full</Button>);
      expect(html).toContain("milo-btn--full");
      expect(html).toContain("extra-class");
    });

    it("handles loading state with spinner and accessibility attributes", () => {
      const html = renderToString(<Button loading>Thinking...</Button>);
      expect(html).toContain("milo-btn--loading");
      expect(html).toContain('aria-busy="true"');
      expect(html).toContain("disabled");
      expect(html).toContain("milo-btn__spinner");
    });

    it("renders left and right icons correctly", () => {
      const leftIcon = <span data-testid="left-icon">🐾</span>;
      const leftHtml = renderToString(<Button icon={leftIcon} iconPosition="left">Pet</Button>);
      expect(leftHtml).toContain("milo-btn__icon--left");
      expect(leftHtml).toContain("🐾");

      const rightIcon = <span data-testid="right-icon">➡️</span>;
      const rightHtml = renderToString(<Button icon={rightIcon} iconPosition="right">Next</Button>);
      expect(rightHtml).toContain("milo-btn__icon--right");
      expect(rightHtml).toContain("➡️");
    });
  });

  describe("Card", () => {
    it("renders default outlined variant with md padding", () => {
      const html = renderToString(<Card>Card Content</Card>);
      expect(html).toContain("milo-card");
      expect(html).toContain("milo-card--outlined");
      expect(html).toContain("milo-card--pad-md");
      expect(html).toContain("Card Content");
    });

    it("renders flat, elevated, and interactive variants", () => {
      const flatHtml = renderToString(<Card variant="flat">Flat</Card>);
      expect(flatHtml).toContain("milo-card--flat");

      const elevatedHtml = renderToString(<Card variant="elevated">Elevated</Card>);
      expect(elevatedHtml).toContain("milo-card--elevated");

      const interactiveHtml = renderToString(<Card variant="interactive">Interactive</Card>);
      expect(interactiveHtml).toContain("milo-card--interactive");
      expect(interactiveHtml).toContain('role="button"');
      expect(interactiveHtml).toContain('tabindex="0"');
    });

    it("supports accent borders: coral, safe, confident, playful", () => {
      const coralHtml = renderToString(<Card accent="coral">Coral</Card>);
      expect(coralHtml).toContain("milo-card--accent-coral");

      const safeHtml = renderToString(<Card accent="safe">Safe</Card>);
      expect(safeHtml).toContain("milo-card--accent-safe");

      const confidentHtml = renderToString(<Card accent="confident">Confident</Card>);
      expect(confidentHtml).toContain("milo-card--accent-confident");

      const playfulHtml = renderToString(<Card accent="playful">Playful</Card>);
      expect(playfulHtml).toContain("milo-card--accent-playful");
    });

    it("supports selected state and accessibility attributes", () => {
      const html = renderToString(<Card selected>Selected Item</Card>);
      expect(html).toContain("milo-card--selected");
      expect(html).toContain('aria-selected="true"');
    });
  });

  describe("Container & Stack & SectionGroup", () => {
    it("renders Container with sizes and paddings", () => {
      const html = renderToString(
        <Container size="sm" padding="lg">
          Inside Container
        </Container>,
      );
      expect(html).toContain("milo-container");
      expect(html).toContain("milo-container--sm");
      expect(html).toContain("milo-container--pad-lg");
      expect(html).toContain("Inside Container");
    });

    it("renders Stack with direction, gap, align, and justify classes", () => {
      const html = renderToString(
        <Stack direction="row" gap="lg" align="center" justify="between" wrap>
          <div>A</div>
          <div>B</div>
        </Stack>,
      );
      expect(html).toContain("milo-stack");
      expect(html).toContain("milo-stack--row");
      expect(html).toContain("milo-stack--gap-lg");
      expect(html).toContain("milo-stack--align-center");
      expect(html).toContain("milo-stack--justify-between");
      expect(html).toContain("milo-stack--wrap");
    });

    it("renders SectionGroup as non-nested layout organizer", () => {
      const html = renderToString(
        <SectionGroup
          title="Companion Settings"
          subtitle="Adjust cat demeanor and sound effects"
          kicker="Preferences"
          action={<button type="button">Reset</button>}
          divider
        >
          <div>Group content</div>
        </SectionGroup>,
      );
      expect(html).toContain("milo-section-group");
      expect(html).toContain("milo-section-group--divider");
      expect(html).toContain("milo-section-group__header");
      expect(html).toContain("milo-section-group__title");
      expect(html).toContain("Companion Settings");
      expect(html).toContain("milo-section-group__subtitle");
      expect(html).toContain("Adjust cat demeanor and sound effects");
      expect(html).toContain("milo-section-group__kicker");
      expect(html).toContain("Preferences");
      expect(html).toContain("milo-section-group__action");
      expect(html).toContain("Group content");
    });
  });
});
