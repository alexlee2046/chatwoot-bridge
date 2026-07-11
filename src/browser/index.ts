import { createChatwootBridge } from "../core/bridge";

declare global {
  interface Window {
    ChatwootBridge?: {
      create: typeof createChatwootBridge;
    };
  }
}

window.ChatwootBridge = { create: createChatwootBridge };
