// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { StrictMode, useContext } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { ChatwootProvider, ChatwootContext } from "../src/react/provider";
import type { ChatwootBridgeController } from "../src/core/types";

afterEach(() => {
  document.querySelectorAll("script[id^='test-strict-mode-sdk']").forEach((node) => node.remove());
  delete (window as unknown as { chatwootSDK?: unknown }).chatwootSDK;
  delete (window as unknown as { $chatwoot?: unknown }).$chatwoot;
});

function Capture({ onController }: { onController: (c: ChatwootBridgeController | null) => void }) {
  const ctx = useContext(ChatwootContext);
  if (ctx) onController(ctx.controller);
  return null;
}

describe("ChatwootProvider under React.StrictMode", () => {
  it("survives the dev double mount→cleanup→remount without permanently destroying the controller", () => {
    let container: HTMLDivElement | null = document.createElement("div");
    document.body.appendChild(container);
    let root: Root | null = createRoot(container);

    let controller: ChatwootBridgeController | null = null;

    act(() => {
      root!.render(
        <StrictMode>
          <ChatwootProvider
            config={{
              baseUrl: "https://chatwoot.example.com",
              websiteToken: "token",
              scriptId: "test-strict-mode-sdk",
              loadStrategy: "lazy",
            }}
            locale="en"
          >
            <Capture onController={(c) => (controller = c)} />
          </ChatwootProvider>
        </StrictMode>,
      );
    });

    expect(controller).not.toBeNull();
    // The bug: destroy() during Strict Mode's synthetic cleanup left the
    // ref pointing at the dead controller, so every method silently
    // no-oped from then on. open() returning false here (SDK not loaded
    // yet) is expected — the actual regression check is that state isn't
    // stuck in a way no future open() can ever recover from.
    controller!.open();
    expect(document.getElementById("test-strict-mode-sdk")).not.toBeNull();
    expect(controller!.state).not.toBe("idle"); // moved to "loading" — proves open() actually ran, not silently no-op'd post-destroy

    act(() => {
      root!.unmount();
    });
    root = null;
    container?.remove();
    container = null;
  });
});
