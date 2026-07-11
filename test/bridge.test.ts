// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createChatwootBridge } from "../src/core/bridge";
import type { ChatwootWidgetApi } from "../src/core/types";

afterEach(() => {
  document.querySelectorAll("script[id^='test-chatwoot-sdk']").forEach((node) => node.remove());
  delete (window as unknown as { chatwootSDK?: unknown }).chatwootSDK;
  delete (window as unknown as { $chatwoot?: unknown }).$chatwoot;
});

describe("SDK load failure recovery", () => {
  it("removes the failed script tag and re-injects it on a later open() call", () => {
    const scriptId = "test-chatwoot-sdk-error";
    const bridge = createChatwootBridge({
      baseUrl: "https://chatwoot.example.com",
      websiteToken: "token",
      scriptId,
      loadStrategy: "lazy",
    });

    bridge.open();
    const firstScript = document.getElementById(scriptId);
    expect(firstScript).not.toBeNull();

    firstScript?.dispatchEvent(new Event("error"));

    expect(document.getElementById(scriptId)).toBeNull();
    expect(bridge.state).toBe("unavailable");

    bridge.open();
    expect(document.getElementById(scriptId)).not.toBeNull();

    bridge.destroy();
  });
});

describe("identify-before-ready race", () => {
  it("replays setUser once chatwoot:ready fires if it was called before the SDK was ready", () => {
    const setUserSpy = vi.fn();
    const bridge = createChatwootBridge({
      baseUrl: "https://chatwoot.example.com",
      websiteToken: "token",
      scriptId: "test-chatwoot-sdk-identify",
      loadStrategy: "lazy",
    });

    bridge.setUser("visitor-1", { email: "visitor@example.com" });
    expect(setUserSpy).not.toHaveBeenCalled();

    const widgetApi: ChatwootWidgetApi = {
      toggle: vi.fn(),
      setUser: setUserSpy,
      setLocale: vi.fn(),
      setConversationCustomAttributes: vi.fn(),
    };
    (window as unknown as { $chatwoot: ChatwootWidgetApi }).$chatwoot = widgetApi;
    window.dispatchEvent(new CustomEvent("chatwoot:ready"));

    expect(setUserSpy).toHaveBeenCalledWith("visitor-1", { email: "visitor@example.com" });

    bridge.destroy();
  });
});

describe("context reporting", () => {
  it("reports page context via setConversationCustomAttributes, not the contact-level setCustomAttributes", () => {
    const setConversationCustomAttributesSpy = vi.fn();
    const widgetApi: ChatwootWidgetApi = {
      toggle: vi.fn(),
      setUser: vi.fn(),
      setLocale: vi.fn(),
      setConversationCustomAttributes: setConversationCustomAttributesSpy,
    };
    (window as unknown as { $chatwoot: ChatwootWidgetApi }).$chatwoot = widgetApi;

    const bridge = createChatwootBridge({
      baseUrl: "https://chatwoot.example.com",
      websiteToken: "token",
      scriptId: "test-chatwoot-sdk-context",
      loadStrategy: "lazy",
      getContext: () => ({ page: "/cart" }),
    });

    window.dispatchEvent(new CustomEvent("chatwoot:ready"));

    expect(setConversationCustomAttributesSpy).toHaveBeenCalledWith({ page: "/cart" });
    expect((widgetApi as unknown as { setCustomAttributes?: unknown }).setCustomAttributes).toBeUndefined();

    bridge.destroy();
  });
});
