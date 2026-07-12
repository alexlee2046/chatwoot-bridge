// src/react/provider.tsx
import * as React from "react";

// src/core/messages.ts
function resolveMessages(messages, locale, fallbackLocale = "en") {
  if (!messages) return {};
  return messages[locale] ?? messages[fallbackLocale] ?? {};
}

// src/core/settings.ts
var DEFAULT_SETTINGS = {
  position: "right",
  type: "standard",
  darkMode: "light",
  hideMessageBubble: false,
  showPopoutButton: false
};
function buildChatwootSettings(config, locale) {
  const messages = resolveMessages(config.messages, locale, config.fallbackLocale ?? "en");
  const chatwootLocale = config.localeMap?.[locale] ?? locale;
  return {
    ...DEFAULT_SETTINGS,
    ...config.settings,
    locale: chatwootLocale,
    ...messages
  };
}
function applyChatwootSettings(config, locale) {
  if (typeof window === "undefined") return;
  window.chatwootSettings = buildChatwootSettings(config, locale);
}

// src/core/loader.ts
function loadChatwootScript(options, onReady, onError) {
  if (typeof document === "undefined") return;
  if (window.chatwootSDK) {
    onReady();
    return;
  }
  const existing = document.getElementById(options.scriptId);
  if (existing) {
    existing.addEventListener("load", onReady, { once: true });
    existing.addEventListener(
      "error",
      () => {
        existing.remove();
        onError();
      },
      { once: true }
    );
    return;
  }
  const script = document.createElement("script");
  script.id = options.scriptId;
  script.src = `${options.baseUrl}/packs/js/sdk.js`;
  script.defer = true;
  script.async = true;
  script.addEventListener(
    "load",
    () => {
      window.chatwootSDK?.run({
        websiteToken: options.websiteToken,
        baseUrl: options.baseUrl
      });
      onReady();
    },
    { once: true }
  );
  script.addEventListener(
    "error",
    () => {
      script.remove();
      onError();
    },
    { once: true }
  );
  document.head.appendChild(script);
}

// src/core/events.ts
var CHATWOOT_DOM_EVENTS = {
  ready: "chatwoot:ready",
  opened: "chatwoot:opened",
  closed: "chatwoot:closed"
};
function dispatchUnavailable(eventName) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(eventName));
}
function createEventBridge(unavailableEventName) {
  const handlers = /* @__PURE__ */ new Map();
  const domListeners = [];
  function emit(event, payload) {
    handlers.get(event)?.forEach((handler) => handler(payload));
  }
  function on(event, handler) {
    if (!handlers.has(event)) handlers.set(event, /* @__PURE__ */ new Set());
    handlers.get(event)?.add(handler);
    return () => {
      handlers.get(event)?.delete(handler);
    };
  }
  if (typeof window !== "undefined") {
    Object.keys(CHATWOOT_DOM_EVENTS).forEach((key) => {
      const type = CHATWOOT_DOM_EVENTS[key];
      const listener = (event) => emit(key, event.detail);
      window.addEventListener(type, listener);
      domListeners.push({ type, listener });
    });
    const unavailableListener = (event) => emit("unavailable", event.detail);
    window.addEventListener(unavailableEventName, unavailableListener);
    domListeners.push({ type: unavailableEventName, listener: unavailableListener });
  }
  function destroy() {
    domListeners.forEach(({ type, listener }) => window.removeEventListener(type, listener));
    domListeners.length = 0;
    handlers.clear();
  }
  return { on, emit, destroy };
}

// src/core/retry.ts
function tryOpenNow() {
  const widget = typeof window !== "undefined" ? window.$chatwoot : void 0;
  if (!widget) return false;
  widget.toggle("open");
  return true;
}
function isChatwootFrameVisible() {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  const widget = document.getElementById("chatwoot_live_chat_widget");
  if (!(widget instanceof HTMLElement)) return false;
  const style = window.getComputedStyle(widget);
  const bounds = widget.getBoundingClientRect();
  return style.display !== "none" && style.visibility !== "hidden" && bounds.width > 0 && bounds.height > 0;
}
function createRetryController(options) {
  let pending = false;
  let attempts = 0;
  let timer;
  function clearTimer() {
    if (timer !== void 0) {
      clearTimeout(timer);
      timer = void 0;
    }
  }
  function fail() {
    pending = false;
    attempts = 0;
    dispatchUnavailable(options.unavailableEventName);
  }
  function scheduleNext() {
    if (attempts >= options.openRetryLimit) {
      fail();
      return;
    }
    attempts += 1;
    timer = setTimeout(() => {
      if (!pending) return;
      if (tryOpenNow()) {
        settle();
        return;
      }
      scheduleNext();
    }, options.openRetryMs);
  }
  function settle() {
    if (!options.verifyOpen) {
      pending = false;
      attempts = 0;
      return;
    }
    timer = setTimeout(() => {
      if (!pending) return;
      if (isChatwootFrameVisible()) {
        pending = false;
        attempts = 0;
        return;
      }
      scheduleNext();
    }, options.verifyOpenMs);
  }
  function attemptOpen() {
    if (tryOpenNow()) {
      if (!options.verifyOpen) return true;
      pending = true;
      attempts = 0;
      settle();
      return true;
    }
    if (!pending) {
      pending = true;
      attempts = 0;
      scheduleNext();
    }
    return false;
  }
  function cancel() {
    pending = false;
    attempts = 0;
    clearTimer();
  }
  return { attemptOpen, cancel };
}

// src/core/bridge.ts
var DEFAULT_SCRIPT_ID = "@mwl/chatwoot-bridge-sdk";
var DEFAULT_UNAVAILABLE_EVENT = "chatwoot-bridge:unavailable";
function createChatwootBridge(config) {
  const scriptId = config.scriptId ?? DEFAULT_SCRIPT_ID;
  const fallbackLocale = config.fallbackLocale ?? "en";
  const unavailableEventName = config.unavailableEventName ?? DEFAULT_UNAVAILABLE_EVENT;
  const reportContextOn = config.reportContextOn ?? ["ready", "opened"];
  let locale = config.locale ?? fallbackLocale;
  let state = "idle";
  let widgetOpen = false;
  let scriptRequested = false;
  let destroyed = false;
  let pendingUser;
  function applyUser(identifier, user) {
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
    unavailableEventName
  });
  function reportContext() {
    if (!config.getContext) return;
    if (typeof window === "undefined" || !window.$chatwoot) return;
    window.$chatwoot.setConversationCustomAttributes(config.getContext());
  }
  const unsubscribers = [
    events.on("ready", () => {
      state = "ready";
      if (pendingUser) applyUser(pendingUser.identifier, pendingUser.user);
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
      scriptRequested = false;
    })
  ];
  function ensureScriptLoaded() {
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
      }
    );
  }
  if ((config.loadStrategy ?? "lazy") === "eager") {
    ensureScriptLoaded();
  }
  function open() {
    if (destroyed) return false;
    ensureScriptLoaded();
    return retry.attemptOpen();
  }
  function close() {
    if (destroyed) return;
    if (typeof window !== "undefined" && window.$chatwoot) {
      window.$chatwoot.toggle("close");
    }
  }
  function toggle() {
    if (destroyed) return;
    if (widgetOpen) {
      close();
    } else {
      open();
    }
  }
  function setLocale(newLocale) {
    if (destroyed) return;
    locale = newLocale;
    applyChatwootSettings(config, locale);
    const chatwootLocale = config.localeMap?.[newLocale] ?? newLocale;
    if (typeof window !== "undefined" && window.$chatwoot) {
      window.$chatwoot.setLocale(chatwootLocale);
    }
  }
  function setUser(identifier, user) {
    if (destroyed) return;
    pendingUser = { identifier, user };
    applyUser(identifier, user);
  }
  function updateContext(attrs) {
    if (destroyed) return;
    if (typeof window === "undefined" || !window.$chatwoot) return;
    const resolved = attrs ?? config.getContext?.();
    if (resolved) window.$chatwoot.setConversationCustomAttributes(resolved);
  }
  function destroy() {
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
    destroy
  };
}

// src/react/provider.tsx
import { jsx } from "react/jsx-runtime";
var ChatwootContext = React.createContext(void 0);
var IDLE_LAUNCHER_STATE = {
  state: "idle",
  pending: false,
  unavailable: false,
  widgetOpen: false
};
function ChatwootProvider(props) {
  const { config, locale, user, children } = props;
  const [controller, setController] = React.useState(null);
  const [launcherState, setLauncherState] = React.useState(IDLE_LAUNCHER_STATE);
  React.useEffect(() => {
    const instance = createChatwootBridge(config);
    setController(instance);
    setLauncherState({
      state: instance.state,
      pending: false,
      unavailable: instance.state === "unavailable",
      widgetOpen: false
    });
    const unsubscribers = [
      instance.on("ready", () => {
        setLauncherState((prev) => ({ ...prev, state: instance.state, pending: false }));
      }),
      instance.on("opened", () => {
        setLauncherState((prev) => ({ ...prev, widgetOpen: true, pending: false }));
      }),
      instance.on("closed", () => {
        setLauncherState((prev) => ({ ...prev, widgetOpen: false }));
      }),
      instance.on("unavailable", () => {
        setLauncherState((prev) => ({ ...prev, state: "unavailable", unavailable: true, pending: false }));
      })
    ];
    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      instance.destroy();
      setController(null);
    };
  }, [config]);
  React.useEffect(() => {
    controller?.setLocale(locale);
  }, [controller, locale]);
  React.useEffect(() => {
    if (controller && user?.email) {
      controller.setUser(user.email, user);
    }
  }, [controller, user?.email, user?.name]);
  const requestOpen = React.useCallback(() => {
    if (!controller) return false;
    const openedImmediately = controller.open();
    if (!openedImmediately) {
      setLauncherState((prev) => ({ ...prev, pending: true, unavailable: false }));
    }
    return openedImmediately;
  }, [controller]);
  const value = React.useMemo(
    () => ({ controller, launcherState, requestOpen }),
    [controller, launcherState, requestOpen]
  );
  return /* @__PURE__ */ jsx(ChatwootContext.Provider, { value, children });
}

// src/react/hooks.ts
import * as React2 from "react";
function useChatwootContext() {
  const context = React2.useContext(ChatwootContext);
  if (!context) {
    throw new Error("useChatwoot must be used within a <ChatwootProvider>");
  }
  return context;
}
function useChatwoot() {
  const { controller, launcherState, requestOpen } = useChatwootContext();
  return React2.useMemo(
    () => ({
      open: () => {
        requestOpen();
      },
      close: () => {
        controller?.close();
      },
      toggle: () => {
        if (launcherState.widgetOpen) {
          controller?.close();
        } else {
          requestOpen();
        }
      },
      updateContext: (attrs) => {
        controller?.updateContext(attrs);
      }
    }),
    [controller, requestOpen, launcherState.widgetOpen]
  );
}
function useChatwootLauncher() {
  const { controller, launcherState, requestOpen } = useChatwootContext();
  const open = React2.useCallback(() => {
    requestOpen();
  }, [requestOpen]);
  const updateContext = React2.useCallback(
    (attrs) => {
      controller?.updateContext(attrs);
    },
    [controller]
  );
  return {
    state: launcherState.state,
    pending: launcherState.pending,
    unavailable: launcherState.unavailable,
    widgetOpen: launcherState.widgetOpen,
    open,
    updateContext
  };
}
export {
  ChatwootProvider,
  useChatwoot,
  useChatwootLauncher
};
//# sourceMappingURL=index.js.map