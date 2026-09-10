import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MiloRenderer, STATE_METADATA } from "../src/renderer/components/MiloRenderer";
import type { DesktopSnapshot } from "../src/shared/contracts";

describe("MiloRenderer Component (Milestone 2 Requirement R3)", () => {
  it("renders default idle state with P:0 priority badge and rest category", () => {
    const html = renderToString(<MiloRenderer />);

    expect(html).toContain("milo-renderer");
    expect(html).toContain("milo-renderer--idle");
    expect(html).toContain("milo-renderer--cat-rest");
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("P:0");
    expect(html).toContain("REST");
    expect(html).toContain("Idle");
    expect(html).toContain("Milo is resting peacefully.");
    expect(html).toContain('data-testid="milo-state-box"');
  });

  it("renders dragging state with P:100 priority badge and physics visual box", () => {
    const html = renderToString(
      <MiloRenderer characterState="dragging" priority={100} />,
    );

    expect(html).toContain("milo-renderer--dragging");
    expect(html).toContain("milo-renderer--cat-physics");
    expect(html).toContain("P:100");
    expect(html).toContain("PHYSICS");
    expect(html).toContain("Dragging");
    expect(html).toContain("Milo is being moved across the desktop.");
  });

  it("renders level_up state with P:80 priority badge and progression visual box", () => {
    const html = renderToString(
      <MiloRenderer characterState="level_up" priority={80} />,
    );

    expect(html).toContain("milo-renderer--level_up");
    expect(html).toContain("milo-renderer--cat-progression");
    expect(html).toContain("P:80");
    expect(html).toContain("PROGRESSION");
    expect(html).toContain("Level Up!");
  });

  it("renders all 19 states with valid labels and categories", () => {
    const states = Object.keys(STATE_METADATA) as (keyof typeof STATE_METADATA)[];
    expect(states.length).toBe(19);

    for (const state of states) {
      const meta = STATE_METADATA[state];
      const html = renderToString(<MiloRenderer characterState={state} />);

      expect(html).toContain(`milo-renderer--${state}`);
      expect(html).toContain(`milo-renderer--cat-${meta.category}`);
      expect(html).toContain(meta.label);
      expect(html).toContain(`P:${meta.defaultPriority}`);
    }
  });

  it("respects showDiagnostics flag", () => {
    const withDiag = renderToString(
      <MiloRenderer characterState="thinking" showDiagnostics={true} />,
    );
    expect(withDiag).toContain("milo-renderer__diagnostics");
    expect(withDiag).toContain("Animation:");

    const withoutDiag = renderToString(
      <MiloRenderer characterState="thinking" showDiagnostics={false} />,
    );
    expect(withoutDiag).not.toContain("milo-renderer__diagnostics");
  });

  it("renders state from snapshot override", () => {
    const mockSnapshot: DesktopSnapshot = {
      state: "ready",
      panelOpen: false,
      panelPlacement: "right-down",
      watching: {
        paused: false,
        selectedWindow: null,
        capability: { available: true },
      },
      settings: {
        theme: "dark",
        motion: "full",
        showWatchingIndicator: true,
      },
      auth: {
        status: "authenticated",
        expiresAt: null,
        storageAvailable: true,
      },
      replies: [],
      lastAction: "none",
      character: {
        currentState: "celebrating",
        previousState: "ready",
        currentPriority: 75,
        activeAnimation: {
          name: "anim-streak-1",
          state: "celebrating",
          priority: 75,
          interruptible: true,
          startedAt: 123456789,
          duration: 2500,
        },
        lastTransitionTime: 123456789,
        transitionReason: "REPLY_COPIED",
      },
    };

    const html = renderToString(<MiloRenderer snapshot={mockSnapshot} />);
    expect(html).toContain("milo-renderer--celebrating");
    expect(html).toContain("P:75");
    expect(html).toContain("Celebrating");
    expect(html).toContain("anim-streak-1");
  });
});
