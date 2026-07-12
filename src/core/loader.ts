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
    existing.addEventListener(
      "error",
      () => {
        existing.remove();
        onError();
      },
      { once: true },
    );
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
  script.addEventListener(
    "error",
    () => {
      // Pre-migration site implementations all logged something here — the
      // only observable trace of an SDK load failure otherwise is the
      // unavailable event, which is silent if nothing on the page happens
      // to listen for it.
      console.warn(`@mwl/chatwoot-bridge: failed to load Chatwoot SDK from ${options.baseUrl}`);
      script.remove();
      onError();
    },
    { once: true },
  );
  document.head.appendChild(script);
}
