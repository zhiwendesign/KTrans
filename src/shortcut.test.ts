import { describe, expect, it } from "vitest";
import { matchesShortcut, shortcutFromEvent } from "./shortcut";

function keyboardEvent(key: string, options: KeyboardEventInit = {}): KeyboardEvent {
  return {
    key,
    ctrlKey: options.ctrlKey ?? false,
    altKey: options.altKey ?? false,
    shiftKey: options.shiftKey ?? false,
    metaKey: options.metaKey ?? false
  } as KeyboardEvent;
}

describe("selection shortcuts", () => {
  it("serializes modifier shortcuts in a stable order", () => {
    expect(shortcutFromEvent(keyboardEvent("q", { altKey: true, shiftKey: true }))).toBe("Alt+Shift+Q");
  });

  it("ignores modifier-only key presses", () => {
    expect(shortcutFromEvent(keyboardEvent("Alt", { altKey: true }))).toBeNull();
  });

  it("matches a configured shortcut", () => {
    expect(matchesShortcut(keyboardEvent("q", { altKey: true }), "Alt+Q")).toBe(true);
  });
});
