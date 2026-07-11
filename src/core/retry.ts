import { dispatchUnavailable } from "./events";

export interface RetryOptions {
  openRetryLimit: number;
  openRetryMs: number;
  verifyOpen: boolean;
  verifyOpenMs: number;
  unavailableEventName: string;
}

export interface RetryController {
  attemptOpen(): boolean;
  cancel(): void;
}

function tryOpenNow(): boolean {
  const widget = typeof window !== "undefined" ? window.$chatwoot : undefined;
  if (!widget) return false;
  widget.toggle("open");
  return true;
}

function isChatwootFrameVisible(): boolean {
  if (typeof document === "undefined") return false;
  const holder = document.getElementById("cw-widget-holder");
  const iframe = holder?.querySelector("iframe");
  if (!iframe) return false;
  const rect = iframe.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

export function createRetryController(options: RetryOptions): RetryController {
  let pending = false;
  let attempts = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function clearTimer(): void {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
  }

  function fail(): void {
    pending = false;
    attempts = 0;
    dispatchUnavailable(options.unavailableEventName);
  }

  function scheduleNext(): void {
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

  function settle(): void {
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

  function attemptOpen(): boolean {
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

  function cancel(): void {
    pending = false;
    attempts = 0;
    clearTimer();
  }

  return { attemptOpen, cancel };
}
