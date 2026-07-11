import * as React from "react";
import { createChatwootBridge } from "../core/bridge";
import type { BridgeState, ChatwootBridgeConfig, ChatwootBridgeController } from "../core/types";

export interface ChatwootLauncherState {
  state: BridgeState;
  pending: boolean;
  unavailable: boolean;
  widgetOpen: boolean;
}

export interface ChatwootContextValue {
  controller: ChatwootBridgeController;
  launcherState: ChatwootLauncherState;
  requestOpen: () => boolean;
}

export const ChatwootContext = React.createContext<ChatwootContextValue | undefined>(undefined);

export interface ChatwootProviderProps {
  config: ChatwootBridgeConfig;
  locale: string;
  user?: { email?: string; name?: string };
  children: React.ReactNode;
}

export function ChatwootProvider(props: ChatwootProviderProps): JSX.Element {
  const { config, locale, user, children } = props;

  const controllerRef = React.useRef<ChatwootBridgeController>();
  if (!controllerRef.current) {
    controllerRef.current = createChatwootBridge(config);
  }
  const controller = controllerRef.current;

  const [launcherState, setLauncherState] = React.useState<ChatwootLauncherState>(() => ({
    state: controller.state,
    pending: false,
    unavailable: controller.state === "unavailable",
    widgetOpen: false,
  }));

  React.useEffect(() => {
    const unsubscribers = [
      controller.on("ready", () => {
        setLauncherState((prev) => ({ ...prev, state: controller.state, pending: false }));
      }),
      controller.on("opened", () => {
        setLauncherState((prev) => ({ ...prev, widgetOpen: true, pending: false }));
      }),
      controller.on("closed", () => {
        setLauncherState((prev) => ({ ...prev, widgetOpen: false }));
      }),
      controller.on("unavailable", () => {
        setLauncherState((prev) => ({ ...prev, state: "unavailable", unavailable: true, pending: false }));
      }),
    ];
    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [controller]);

  React.useEffect(() => {
    controller.setLocale(locale);
  }, [controller, locale]);

  React.useEffect(() => {
    if (user?.email) {
      controller.setUser(user.email, user);
    }
  }, [controller, user?.email, user?.name]);

  React.useEffect(() => {
    return () => {
      controller.destroy();
    };
  }, [controller]);

  const requestOpen = React.useCallback((): boolean => {
    const openedImmediately = controller.open();
    if (!openedImmediately) {
      setLauncherState((prev) => ({ ...prev, pending: true }));
    }
    return openedImmediately;
  }, [controller]);

  const value = React.useMemo<ChatwootContextValue>(
    () => ({ controller, launcherState, requestOpen }),
    [controller, launcherState, requestOpen],
  );

  return <ChatwootContext.Provider value={value}>{children}</ChatwootContext.Provider>;
}
