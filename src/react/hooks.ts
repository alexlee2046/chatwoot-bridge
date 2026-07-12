import * as React from "react";
import { ChatwootContext } from "./provider";
import type { BridgeState } from "../core/types";

function useChatwootContext() {
  const context = React.useContext(ChatwootContext);
  if (!context) {
    throw new Error("useChatwoot must be used within a <ChatwootProvider>");
  }
  return context;
}

export function useChatwoot(): {
  open: () => void;
  close: () => void;
  toggle: () => void;
  updateContext: (attrs?: Record<string, string>) => void;
} {
  const { controller, launcherState, requestOpen } = useChatwootContext();

  return React.useMemo(
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
      updateContext: (attrs?: Record<string, string>) => {
        controller?.updateContext(attrs);
      },
    }),
    [controller, requestOpen, launcherState.widgetOpen],
  );
}

export function useChatwootLauncher(): {
  state: BridgeState;
  pending: boolean;
  unavailable: boolean;
  widgetOpen: boolean;
  open: () => void;
  updateContext: (attrs?: Record<string, string>) => void;
} {
  const { controller, launcherState, requestOpen } = useChatwootContext();

  const open = React.useCallback(() => {
    requestOpen();
  }, [requestOpen]);

  const updateContext = React.useCallback(
    (attrs?: Record<string, string>) => {
      controller?.updateContext(attrs);
    },
    [controller],
  );

  return {
    state: launcherState.state,
    pending: launcherState.pending,
    unavailable: launcherState.unavailable,
    widgetOpen: launcherState.widgetOpen,
    open,
    updateContext,
  };
}
