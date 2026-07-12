import { applyChatwootSettings } from "./settings";
import { loadChatwootScript } from "./loader";
import { createEventBridge, dispatchUnavailable } from "./events";
import { createRetryController, isChatwootFrameVisible } from "./retry";
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
  let pendingUser: { identifier: string; user: { name?: string; email?: string } } | undefined;

  function applyUser(identifier: string, user: { name?: string; email?: string }): void {
    if (typeof window !== "undefined" && window.$chatwoot) {
      window.$chatwoot.setUser(identifier, user);
    }
  }

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
    // Checking the method itself, not just window.$chatwoot's presence —
    // some SDK init sequences can expose the object slightly before every
    // method is attached to it.
    if (typeof window === "undefined" || !window.$chatwoot?.setConversationCustomAttributes) return;
    window.$chatwoot.setConversationCustomAttributes(config.getContext());
  }

  const unsubscribers = [
    events.on("ready", () => {
      state = "ready";
      if (pendingUser) applyUser(pendingUser.identifier, pendingUser.user);
      if (reportContextOn.includes("ready")) reportContext();
      // A queued open() shouldn't have to wait for the next poll tick once
      // the SDK actually signals ready.
      retry.notifyReady();
    }),
    events.on("opened", () => {
      // Chatwoot's own "opened" event means its internal state toggled open,
      // not necessarily that the frame rendered visibly (CSS conflict /
      // viewport edge case). When verifyOpen is configured we hold the same
      // bar here that attemptOpen()'s own settle() does, rather than trusting
      // the raw event unconditionally.
      if (config.verifyOpen && !isChatwootFrameVisible()) {
        dispatchUnavailable(unavailableEventName);
        return;
      }
      widgetOpen = true;
      if (reportContextOn.includes("opened")) reportContext();
    }),
    events.on("closed", () => {
      widgetOpen = false;
    }),
    events.on("unavailable", () => {
      state = "unavailable";
      scriptRequested = false;
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
    pendingUser = { identifier, user };
    applyUser(identifier, user);
  }

  function updateContext(attrs?: Record<string, string>): void {
    if (destroyed) return;
    if (typeof window === "undefined" || !window.$chatwoot?.setConversationCustomAttributes) return;
    const resolved = attrs ?? config.getContext?.();
    if (resolved) window.$chatwoot.setConversationCustomAttributes(resolved);
  }

  function destroy(): void {
    if (destroyed) return;
    // Close the widget before tearing down — otherwise a consumer that
    // unmounts its Provider (route change, conditional render) leaves
    // Chatwoot's iframe/bubble floating on a page it no longer belongs to,
    // since nothing else would ever call close() for it again.
    if (widgetOpen) close();
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
