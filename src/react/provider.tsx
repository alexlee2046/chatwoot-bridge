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
  // Null for the brief window between the Provider mounting and its
  // creation effect running (see below) — practically imperceptible, but
  // real, since the controller is now created inside useEffect rather than
  // synchronously in the render body.
  controller: ChatwootBridgeController | null;
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

const IDLE_LAUNCHER_STATE: ChatwootLauncherState = {
  state: "idle",
  pending: false,
  unavailable: false,
  widgetOpen: false,
};

export function ChatwootProvider(props: ChatwootProviderProps): JSX.Element {
  const { config, locale, user, children } = props;

  // Created inside an effect (not a lazily-initialized ref) so React
  // StrictMode's dev-only mount→cleanup→remount simulation gets a genuinely
  // fresh controller on remount. A ref-based singleton can't survive that:
  // the simulation re-invokes the SAME captured effect closures (same
  // `controller` variable) rather than re-rendering, so a fresh render
  // never happens for a ref-guard to matter — cleanup would destroy the one
  // and only controller, and "remount" would just re-subscribe onto the
  // now-dead instance. Creating it in the effect means cleanup destroys
  // *this* run's instance and setup always makes a new, live one.
  const [controller, setController] = React.useState<ChatwootBridgeController | null>(null);
  const [launcherState, setLauncherState] = React.useState<ChatwootLauncherState>(IDLE_LAUNCHER_STATE);

  React.useEffect(() => {
    const instance = createChatwootBridge(config);
    setController(instance);
    setLauncherState({
      state: instance.state,
      pending: false,
      unavailable: instance.state === "unavailable",
      widgetOpen: false,
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
      }),
    ];

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      instance.destroy();
      setController(null);
    };
    // `config` is a module-level/memoized constant in every known caller —
    // an identity change intentionally tears down and recreates the bridge.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  // Skips exactly one setLocale() call: the first one to run once `controller`
  // exists, if `locale` is already what `config.locale` seeded into the
  // eager settings write. Consumers that pre-seed config.locale to avoid a
  // redundant settings write on mount get what they're actually asking for;
  // consumers that don't (config.locale left undefined) see no behavior
  // change — this never skips a genuine locale change afterward.
  const skippedInitialLocaleSyncRef = React.useRef(false);
  React.useEffect(() => {
    if (!controller) return;
    if (!skippedInitialLocaleSyncRef.current) {
      skippedInitialLocaleSyncRef.current = true;
      if (locale === config.locale) return;
    }
    controller.setLocale(locale);
  }, [controller, locale, config.locale]);

  React.useEffect(() => {
    if (controller && user?.email) {
      controller.setUser(user.email, user);
    }
  }, [controller, user?.email, user?.name]);

  const requestOpen = React.useCallback((): boolean => {
    if (!controller) return false;
    const openedImmediately = controller.open();
    if (!openedImmediately) {
      setLauncherState((prev) => ({ ...prev, pending: true, unavailable: false }));
    }
    return openedImmediately;
  }, [controller]);

  const value = React.useMemo<ChatwootContextValue>(
    () => ({ controller, launcherState, requestOpen }),
    [controller, launcherState, requestOpen],
  );

  return <ChatwootContext.Provider value={value}>{children}</ChatwootContext.Provider>;
}
