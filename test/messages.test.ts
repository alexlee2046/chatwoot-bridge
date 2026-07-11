import { describe, expect, it } from "vitest";
import { resolveMessages } from "../src/core/messages";
import type { LocaleMessages } from "../src/core/types";

const messages: LocaleMessages = {
  en: { unavailableMessage: "We're away — leave us a message." },
  de: { unavailableMessage: "Wir sind gerade nicht da." },
};

describe("resolveMessages", () => {
  it("returns the message set for a matched locale", () => {
    expect(resolveMessages(messages, "de")).toEqual({
      unavailableMessage: "Wir sind gerade nicht da.",
    });
  });

  it("falls back to the fallback locale when the locale is missing", () => {
    expect(resolveMessages(messages, "ja", "en")).toEqual({
      unavailableMessage: "We're away — leave us a message.",
    });
  });

  it("returns an empty object when neither the locale nor the fallback exist", () => {
    expect(resolveMessages(messages, "ja", "fr")).toEqual({});
  });

  it("returns an empty object when no messages table is provided", () => {
    expect(resolveMessages(undefined, "en")).toEqual({});
  });
});
