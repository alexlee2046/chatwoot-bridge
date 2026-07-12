import { resolveMessages } from "./messages";
import type { ChatwootBridgeConfig, ChatwootSettings } from "./types";

const DEFAULT_SETTINGS: ChatwootSettings = {
  position: "right",
  type: "standard",
  darkMode: "light",
  hideMessageBubble: false,
  showPopoutButton: false,
};

export function buildChatwootSettings(
  config: ChatwootBridgeConfig,
  locale: string,
): ChatwootSettings {
  const messages = resolveMessages(config.messages, locale, config.fallbackLocale ?? "en");
  const chatwootLocale = config.localeMap?.[locale] ?? locale;

  return {
    ...DEFAULT_SETTINGS,
    ...config.settings,
    locale: chatwootLocale,
    ...messages,
  };
}

export function applyChatwootSettings(config: ChatwootBridgeConfig, locale: string): void {
  if (typeof window === "undefined") return;
  // Merge onto whatever's already there (e.g. a GTM snippet, or another
  // script on the page, may have set window.chatwootSettings fields before
  // this runs) rather than overwriting wholesale — all three pre-migration
  // site implementations did this merge, and dropping it would silently
  // clobber anything set outside the bridge.
  window.chatwootSettings = {
    ...(window.chatwootSettings || {}),
    ...buildChatwootSettings(config, locale),
  };
}
