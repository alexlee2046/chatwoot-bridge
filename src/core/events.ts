import type { BridgeEvent } from "./types";

type Handler = (payload?: unknown) => void;

export interface EventBridge {
  on(event: BridgeEvent, handler: Handler): () => void;
  emit(event: BridgeEvent, payload?: unknown): void;
  destroy(): void;
}

const CHATWOOT_DOM_EVENTS: Record<"ready" | "opened" | "closed", string> = {
  ready: "chatwoot:ready",
  opened: "chatwoot:opened",
  closed: "chatwoot:closed",
};

export function dispatchUnavailable(eventName: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(eventName));
}

export function createEventBridge(unavailableEventName: string): EventBridge {
  const handlers = new Map<BridgeEvent, Set<Handler>>();
  const domListeners: Array<{ type: string; listener: EventListener }> = [];

  function emit(event: BridgeEvent, payload?: unknown): void {
    handlers.get(event)?.forEach((handler) => handler(payload));
  }

  function on(event: BridgeEvent, handler: Handler): () => void {
    if (!handlers.has(event)) handlers.set(event, new Set());
    handlers.get(event)?.add(handler);
    return () => {
      handlers.get(event)?.delete(handler);
    };
  }

  if (typeof window !== "undefined") {
    (Object.keys(CHATWOOT_DOM_EVENTS) as Array<keyof typeof CHATWOOT_DOM_EVENTS>).forEach((key) => {
      const type = CHATWOOT_DOM_EVENTS[key];
      const listener: EventListener = (event) => emit(key, (event as CustomEvent).detail);
      window.addEventListener(type, listener);
      domListeners.push({ type, listener });
    });

    const unavailableListener: EventListener = (event) =>
      emit("unavailable", (event as CustomEvent).detail);
    window.addEventListener(unavailableEventName, unavailableListener);
    domListeners.push({ type: unavailableEventName, listener: unavailableListener });
  }

  function destroy(): void {
    domListeners.forEach(({ type, listener }) => window.removeEventListener(type, listener));
    domListeners.length = 0;
    handlers.clear();
  }

  return { on, emit, destroy };
}
