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
  window.chatwootSettings = buildChatwootSettings(config, locale);
}
