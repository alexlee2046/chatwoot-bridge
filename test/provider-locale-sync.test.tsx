// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { useContext } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatwootProvider, ChatwootContext } from "../src/react/provider";
import type { ChatwootWidgetApi } from "../src/core/types";

afterEach(() => {
  document.querySelectorAll("script[id^='test-locale-sync-sdk']").forEach((node) => node.remove());
  delete (window as unknown as { chatwootSDK?: unknown }).chatwootSDK;
  delete (window as unknown as { $chatwoot?: unknown }).$chatwoot;
});

function Capture({ onReady }: { onReady: () => void }) {
  const ctx = useContext(ChatwootContext);
  if (ctx?.controller) onReady();
  return null;
}

describe("ChatwootProvider locale sync", () => {
  it("skips the first setLocale() call when locale already matches config.locale", async () => {
    const setLocaleSpy = vi.fn();
    const widgetApi: ChatwootWidgetApi = {
      toggle: vi.fn(),
      setUser: vi.fn(),
      setLocale: setLocaleSpy,
      setConversationCustomAttributes: vi.fn(),
    };
    (window as unknown as { $chatwoot: ChatwootWidgetApi }).$chatwoot = widgetApi;

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <ChatwootProvider
          config={{
            baseUrl: "https://chatwoot.example.com",
            websiteToken: "token",
            scriptId: "test-locale-sync-sdk-skip",
            loadStrategy: "lazy",
            locale: "ar",
          }}
          locale="ar"
        >
          <Capture onReady={() => {}} />
        </ChatwootProvider>,
      );
    });

    expect(setLocaleSpy).not.toHaveBeenCalled();

    await act(async () => {
      root.render(
        <ChatwootProvider
          config={{
            baseUrl: "https://chatwoot.example.com",
            websiteToken: "token",
            scriptId: "test-locale-sync-sdk-skip",
            loadStrategy: "lazy",
            locale: "ar",
          }}
          locale="en"
        >
          <Capture onReady={() => {}} />
        </ChatwootProvider>,
      );
    });

    expect(setLocaleSpy).toHaveBeenCalledWith("en");
    act(() => root.unmount());
  });

  it("still calls setLocale() on first mount when config.locale wasn't seeded", async () => {
    const setLocaleSpy = vi.fn();
    const widgetApi: ChatwootWidgetApi = {
      toggle: vi.fn(),
      setUser: vi.fn(),
      setLocale: setLocaleSpy,
      setConversationCustomAttributes: vi.fn(),
    };
    (window as unknown as { $chatwoot: ChatwootWidgetApi }).$chatwoot = widgetApi;

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <ChatwootProvider
          config={{
            baseUrl: "https://chatwoot.example.com",
            websiteToken: "token",
            scriptId: "test-locale-sync-sdk-noseed",
            loadStrategy: "lazy",
            // no `locale` seeded — matches Klackjoy-usm's current config shape
          }}
          locale="zh"
        >
          <Capture onReady={() => {}} />
        </ChatwootProvider>,
      );
    });

    expect(setLocaleSpy).toHaveBeenCalledWith("zh");
    act(() => root.unmount());
  });
});
