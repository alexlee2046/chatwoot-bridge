import type { ChatwootMessageStrings, LocaleMessages } from "./types";

export function resolveMessages(
  messages: LocaleMessages | undefined,
  locale: string,
  fallbackLocale = "en",
): ChatwootMessageStrings {
  if (!messages) return {};
  return messages[locale] ?? messages[fallbackLocale] ?? {};
}
