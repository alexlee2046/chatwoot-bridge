import { applyChatwootSettings } from "./settings";
import { loadChatwootScript } from "./loader";
import { createEventBridge, dispatchUnavailable } from "./events";
import { createRetryController } from "./retry";
import type {
  BridgeState,
  ChatwootBridgeConfig,
  ChatwootBridgeController,
} from "./types";

const DEFAULT_SCRIPT_ID = "@mwl/chatwoot-bridge-sdk";
const DEFAULT_UNAVAILABLE_EVENT = "chatwoot-bridge:unavailable";

export function createChatwootBridge(config: ChatwootBridgeConfig): ChatwootBridgeController {
  const scriptId = config.scriptId ?? DEFAULT_SCRIPT_ID;
  const fallbackLocale = config.fallbackLocale ?? "en";
  const unavailableEventName = config.unavailableEventName ?? DEFAULT_UNAVAILABLE_EVENT;
  const reportContextOn = config.reportContextOn ?? ["ready", "opened"];

  let locale = config.locale ?? fallbackLocale;
  let state: BridgeState = "idle";
  let widgetOpen = false;
  let scriptRequested = false;
  let destroyed = false;

  const events = createEventBridge(unavailableEventName);
  const retry = createRetryController({
    openRetryLimit: config.openRetryLimit ?? 40,
    openRetryMs: config.openRetryMs ?? 250,
    verifyOpen: config.verifyOpen ?? false,
    verifyOpenMs: config.verifyOpenMs ?? 1500,
    unavailableEventName,
  });

  function reportContext(): void {
    if (!config.getContext) return;
    if (typeof window === "undefined" || !window.$chatwoot) return;
    window.$chatwoot.setCustomAttributes(config.getContext());
  }

  const unsubscribers = [
    events.on("ready", () => {
      state = "ready";
      if (reportContextOn.includes("ready")) reportContext();
    }),
    events.on("opened", () => {
      widgetOpen = true;
      if (reportContextOn.includes("opened")) reportContext();
    }),
    events.on("closed", () => {
      widgetOpen = false;
    }),
    events.on("unavailable", () => {
      state = "unavailable";
    }),
  ];

  function ensureScriptLoaded(): void {
    if (scriptRequested) return;
    scriptRequested = true;
    state = "loading";
    applyChatwootSettings(config, locale);
    loadChatwootScript(
      { baseUrl: config.baseUrl, websiteToken: config.websiteToken, scriptId },
      () => {
        if (state === "loading") state = "ready";
      },
      () => {
        dispatchUnavailable(unavailableEventName);
      },
    );
  }

  if ((config.loadStrategy ?? "lazy") === "eager") {
    ensureScriptLoaded();
  }

  function open(): boolean {
    if (destroyed) return false;
    ensureScriptLoaded();
    return retry.attemptOpen();
  }

  function close(): void {
    if (destroyed) return;
    if (typeof window !== "undefined" && window.$chatwoot) {
      window.$chatwoot.toggle("close");
    }
  }

  function toggle(): void {
    if (destroyed) return;
    if (widgetOpen) {
      close();
    } else {
      open();
    }
  }

  function setLocale(newLocale: string): void {
    if (destroyed) return;
    locale = newLocale;
    applyChatwootSettings(config, locale);
    const chatwootLocale = config.localeMap?.[newLocale] ?? newLocale;
    if (typeof window !== "undefined" && window.$chatwoot) {
      window.$chatwoot.setLocale(chatwootLocale);
    }
  }

  function setUser(identifier: string, user: { name?: string; email?: string }): void {
    if (destroyed) return;
    if (typeof window !== "undefined" && window.$chatwoot) {
      window.$chatwoot.setUser(identifier, user);
    }
  }

  function updateContext(attrs?: Record<string, string>): void {
    if (destroyed) return;
    if (typeof window === "undefined" || !window.$chatwoot) return;
    const resolved = attrs ?? config.getContext?.();
    if (resolved) window.$chatwoot.setCustomAttributes(resolved);
  }

  function destroy(): void {
    if (destroyed) return;
    destroyed = true;
    unsubscribers.forEach((unsubscribe) => unsubscribe());
    retry.cancel();
    events.destroy();
  }

  return {
    open,
    close,
    toggle,
    setLocale,
    setUser,
    updateContext,
    on: events.on,
    get state() {
      return state;
    },
    destroy,
  };
}
