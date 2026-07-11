export interface ChatwootLoaderOptions {
  baseUrl: string;
  websiteToken: string;
  scriptId: string;
}

export function loadChatwootScript(
  options: ChatwootLoaderOptions,
  onReady: () => void,
  onError: () => void,
): void {
  if (typeof document === "undefined") return;

  if (window.chatwootSDK) {
    onReady();
    return;
  }

  const existing = document.getElementById(options.scriptId);
  if (existing) {
    existing.addEventListener("load", onReady, { once: true });
    existing.addEventListener("error", onError, { once: true });
    return;
  }

  const script = document.createElement("script");
  script.id = options.scriptId;
  script.src = `${options.baseUrl}/packs/js/sdk.js`;
  script.defer = true;
  script.async = true;
  script.addEventListener(
    "load",
    () => {
      window.chatwootSDK?.run({
        websiteToken: options.websiteToken,
        baseUrl: options.baseUrl,
      });
      onReady();
    },
    { once: true },
  );
  script.addEventListener("error", onError, { once: true });
  document.head.appendChild(script);
}
