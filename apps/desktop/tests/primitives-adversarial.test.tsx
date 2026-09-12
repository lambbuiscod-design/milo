import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  Button,
  Card,
  Container,
  SectionGroup,
  Stack,
} from "../src/renderer/components/primitives";

describe("Adversarial Empirical Verification: Design Tokens & UI Primitives", () => {
  describe("R2. CSS Design Tokens Verification", () => {
    const stylesPath = path.resolve(__dirname, "../src/renderer/styles.css");
    const stylesContent = readFileSync(stylesPath, "utf8");

    it("verifies global canvas foundations and brand accents in :root", () => {
      expect(stylesContent).toContain("--bg-primary: #10131F;");
      expect(stylesContent).toContain("--bg-secondary: #181D2D;");
      expect(stylesContent).toContain("--bg-tertiary: #20263A;");
      expect(stylesContent).toContain("--bg-elevated: #262E45;");
      expect(stylesContent).toContain("--bg-sunken: #0B0D15;");
      expect(stylesContent).toContain("--milo-coral: #FF8066;");
      expect(stylesContent).toContain("--milo-peach: #FFAE8F;");
      expect(stylesContent).toContain("--milo-purple: #886CFF;");
      expect(stylesContent).toContain("--milo-mint: #60E6BD;");
      expect(stylesContent).toContain("--milo-danger: #FF6070;");
      expect(stylesContent).toContain("--milo-coral-hover: #FF947D;");
      expect(stylesContent).toContain("--milo-coral-active: #E66D54;");
      expect(stylesContent).toContain("--on-milo-coral: #10131F;");
    });

    it("verifies dark theme background alias in [data-theme='dark']", () => {
      expect(stylesContent).toContain(':root[data-theme="dark"]');
      expect(stylesContent).toContain("--background: var(--bg-primary);");
      expect(stylesContent).toContain("--surface-primary: var(--bg-secondary);");
      expect(stylesContent).toContain("--surface-elevated: var(--bg-elevated);");
      expect(stylesContent).toContain("--border-focus: var(--milo-coral);");
    });

    it("verifies typography scale variables under :root", () => {
      expect(stylesContent).toContain("--font-size-h1: 30px;");
      expect(stylesContent).toContain("--font-size-h2: 22px;");
      expect(stylesContent).toContain("--font-size-h3: 18px;");
      expect(stylesContent).toContain("--font-size-body: 15px;");
      expect(stylesContent).toContain("--font-size-sm: 13px;");
      expect(stylesContent).toContain("--font-size-caption: 11px;");
    });

    it("verifies utility classes binding to typography scale", () => {
      expect(stylesContent).toContain(".text-h1 {");
      expect(stylesContent).toContain("font-size: var(--font-size-h1);");
      expect(stylesContent).toContain(".text-h2 {");
      expect(stylesContent).toContain("font-size: var(--font-size-h2);");
      expect(stylesContent).toContain(".text-h3 {");
      expect(stylesContent).toContain("font-size: var(--font-size-h3);");
      expect(stylesContent).toContain(".text-body {");
      expect(stylesContent).toContain("font-size: var(--font-size-body);");
      expect(stylesContent).toContain(".text-body-muted {");
      expect(stylesContent).toContain("color: var(--text-secondary);");
      expect(stylesContent).toContain(".text-sm {");
      expect(stylesContent).toContain(".text-caption {");
    });

    it("verifies backwards-compatibility aliases for legacy components", () => {
      expect(stylesContent).toContain("--cat: #2b3044;");
      expect(stylesContent).toContain("--cat-outline: #1c2030;");
      expect(stylesContent).toContain("--cat-ear: #d97757;");
      expect(stylesContent).toContain("--cat-feature: #1b1f2e;");
      expect(stylesContent).toContain("--cat-eye-glint: #ffffff;");
      expect(stylesContent).toContain("--cat-nose: #c86d51;");
      expect(stylesContent).toContain("--state-ready: #10b981;");
      expect(stylesContent).toContain("--state-error: #ef4444;");
      expect(stylesContent).toContain("--state-paused: #9ca3af;");
      expect(stylesContent).toContain("--state-noticed: #f59e0b;");
      expect(stylesContent).toContain("--state-generating: #3b82f6;");
    });
  });

  describe("R3. UI Primitives Adversarial Behavioral Verification", () => {
    describe("Button Component", () => {
      it("suppresses icons completely when in loading state", () => {
        const icon = <span data-testid="test-icon">ICON</span>;
        const htmlLeft = renderToString(
          <Button loading icon={icon} iconPosition="left">
            Submit
          </Button>,
        );
        expect(htmlLeft).not.toContain("milo-btn__icon");
        expect(htmlLeft).not.toContain("ICON");
        expect(htmlLeft).toContain("milo-btn__spinner");
        expect(htmlLeft).toContain('aria-busy="true"');

        const htmlRight = renderToString(
          <Button loading icon={icon} iconPosition="right">
            Submit
          </Button>,
        );
        expect(htmlRight).not.toContain("milo-btn__icon");
        expect(htmlRight).not.toContain("ICON");
      });

      it("handles icon-only button without rendering empty label span", () => {
        const icon = <svg data-testid="cat-svg" />;
        const html = renderToString(
          <Button icon={icon} aria-label="Milo Action" />,
        );
        expect(html).toContain('aria-label="Milo Action"');
        expect(html).toContain("milo-btn__icon--left");
        expect(html).not.toContain("milo-btn__label");
      });

      it("enforces disabled attribute when loading even if disabled={false}", () => {
        const html = renderToString(
          <Button loading disabled={false}>
            Processing
          </Button>,
        );
        expect(html).toContain("disabled");
      });

      it("forwards custom button type and attributes correctly", () => {
        const html = renderToString(
          <Button type="submit" name="action-btn" value="save">
            Save
          </Button>,
        );
        expect(html).toContain('type="submit"');
        expect(html).toContain('name="action-btn"');
        expect(html).toContain('value="save"');
      });
    });

    describe("Card Component", () => {
      it("does not attach button semantics or tabindex when non-interactive", () => {
        const flatHtml = renderToString(<Card variant="flat">Content</Card>);
        expect(flatHtml).not.toContain('role="button"');
        expect(flatHtml).not.toContain("tabindex");

        const outlinedHtml = renderToString(<Card variant="outlined">Content</Card>);
        expect(outlinedHtml).not.toContain('role="button"');
        expect(outlinedHtml).not.toContain("tabindex");

        const elevatedHtml = renderToString(<Card variant="elevated">Content</Card>);
        expect(elevatedHtml).not.toContain('role="button"');
        expect(elevatedHtml).not.toContain("tabindex");
      });

      it("allows custom role and tabIndex overrides on interactive cards", () => {
        const html = renderToString(
          <Card variant="interactive" role="option" tabIndex={-1}>
            Custom Role Card
          </Card>,
        );
        expect(html).toContain('role="option"');
        expect(html).toContain('tabindex="-1"');
      });

      it("omits aria-selected when selected is false", () => {
        const html = renderToString(<Card selected={false}>Unselected</Card>);
        expect(html).not.toContain("aria-selected");
        expect(html).not.toContain("milo-card--selected");
      });

      it("omits accent class when accent='none'", () => {
        const html = renderToString(<Card accent="none">No Accent</Card>);
        expect(html).not.toContain("milo-card--accent");
      });

      it("handles keyboard activation (Enter and Space) on interactive cards", () => {
        const onClick = vi.fn();
        const onKeyDown = vi.fn();

        const renderedDiv = (Card as unknown as { render: (props: unknown, ref: unknown) => React.ReactElement }).render(
          {
            variant: "interactive",
            onClick,
            onKeyDown,
            children: "Interactive Content",
          },
          null,
        );

        const props = renderedDiv.props as { onKeyDown: (e: unknown) => void };

        const preventDefaultEnter = vi.fn();
        props.onKeyDown({ key: "Enter", preventDefault: preventDefaultEnter });
        expect(preventDefaultEnter).toHaveBeenCalledTimes(1);
        expect(onClick).toHaveBeenCalledTimes(1);
        expect(onKeyDown).toHaveBeenCalledTimes(1);

        const preventDefaultSpace = vi.fn();
        props.onKeyDown({ key: " ", preventDefault: preventDefaultSpace });
        expect(preventDefaultSpace).toHaveBeenCalledTimes(1);
        expect(onClick).toHaveBeenCalledTimes(2);

        const preventDefaultTab = vi.fn();
        props.onKeyDown({ key: "Tab", preventDefault: preventDefaultTab });
        expect(preventDefaultTab).not.toHaveBeenCalled();
        expect(onClick).toHaveBeenCalledTimes(2);
      });

      it("does not trigger keyboard activation when card is non-interactive", () => {
        const onClick = vi.fn();
        const renderedDiv = (Card as unknown as { render: (props: unknown, ref: unknown) => React.ReactElement }).render(
          {
            variant: "flat",
            onClick,
            children: "Flat Card",
          },
          null,
        );

        const props = renderedDiv.props as { onKeyDown: (e: unknown) => void };
        const preventDefault = vi.fn();
        props.onKeyDown({ key: "Enter", preventDefault });
        expect(preventDefault).not.toHaveBeenCalled();
        expect(onClick).not.toHaveBeenCalled();
      });
    });

    describe("Container, Stack, and SectionGroup", () => {
      it("applies default sizes and paddings when omitted", () => {
        const containerHtml = renderToString(<Container>Inside</Container>);
        expect(containerHtml).toContain("milo-container--md");
        expect(containerHtml).toContain("milo-container--pad-md");

        const stackHtml = renderToString(<Stack><span>Item</span></Stack>);
        expect(stackHtml).toContain("milo-stack--column");
        expect(stackHtml).toContain("milo-stack--gap-md");
        expect(stackHtml).toContain("milo-stack--align-stretch");
        expect(stackHtml).toContain("milo-stack--justify-start");
        expect(stackHtml).not.toContain("milo-stack--wrap");
      });

      it("omits header element in SectionGroup if title, kicker, and action are missing", () => {
        const html = renderToString(
          <SectionGroup>
            <div>Plain Content</div>
          </SectionGroup>,
        );
        expect(html).toContain("milo-section-group");
        expect(html).not.toContain("milo-section-group__header");
        expect(html).toContain("Plain Content");
      });

      it("supports divider toggle on SectionGroup", () => {
        const withDivider = renderToString(
          <SectionGroup divider={true}>With</SectionGroup>,
        );
        expect(withDivider).toContain("milo-section-group--divider");

        const withoutDivider = renderToString(
          <SectionGroup divider={false}>Without</SectionGroup>,
        );
        expect(withoutDivider).not.toContain("milo-section-group--divider");
      });
    });
  });
});
