interface ChatwootMessageStrings {
    availableMessage?: string;
    unavailableMessage?: string;
    welcomeTitle?: string;
    welcomeDescription?: string;
}
type LocaleMessages = Record<string, ChatwootMessageStrings>;
interface ChatwootSettings {
    position?: "left" | "right";
    type?: "standard" | "expanded_bubble";
    darkMode?: "light" | "auto";
    hideMessageBubble?: boolean;
    showPopoutButton?: boolean;
    locale?: string;
    useBrowserLanguage?: boolean;
    [key: string]: unknown;
}
interface ChatwootBridgeConfig {
    baseUrl: string;
    websiteToken: string;
    loadStrategy?: "lazy" | "eager";
    scriptId?: string;
    settings?: Partial<ChatwootSettings>;
    locale?: string;
    localeMap?: Record<string, string>;
    fallbackLocale?: string;
    messages?: LocaleMessages;
    getContext?: () => Record<string, string>;
    reportContextOn?: Array<"ready" | "opened">;
    openRetryLimit?: number;
    openRetryMs?: number;
    verifyOpen?: boolean;
    verifyOpenMs?: number;
    unavailableEventName?: string;
}
type BridgeState = "idle" | "loading" | "ready" | "unavailable";
type BridgeEvent = "ready" | "opened" | "closed" | "unavailable";
interface ChatwootBridgeController {
    open(): boolean;
    close(): void;
    toggle(): void;
    setLocale(locale: string): void;
    setUser(identifier: string, user: {
        name?: string;
        email?: string;
    }): void;
    updateContext(attrs?: Record<string, string>): void;
    on(event: BridgeEvent, handler: (payload?: unknown) => void): () => void;
    readonly state: BridgeState;
    destroy(): void;
}
interface ChatwootSDK {
    run(options: {
        websiteToken: string;
        baseUrl: string;
    }): void;
}
interface ChatwootWidgetApi {
    toggle(state?: "open" | "close"): void;
    setUser(identifier: string, user: {
        name?: string;
        email?: string;
    }): void;
    setLocale(locale: string): void;
    setConversationCustomAttributes(attrs: Record<string, string>): void;
}
declare global {
    interface Window {
        chatwootSDK?: ChatwootSDK;
        chatwootSettings?: ChatwootSettings;
        $chatwoot?: ChatwootWidgetApi;
    }
}

declare function createChatwootBridge(config: ChatwootBridgeConfig): ChatwootBridgeController;

declare function resolveMessages(messages: LocaleMessages | undefined, locale: string, fallbackLocale?: string): ChatwootMessageStrings;

export { type BridgeEvent, type BridgeState, type ChatwootBridgeConfig, type ChatwootBridgeController, type ChatwootMessageStrings, type ChatwootSettings, type LocaleMessages, createChatwootBridge, resolveMessages };
