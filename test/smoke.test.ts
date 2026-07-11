import { describe, expect, it } from "vitest";
import { createChatwootBridge } from "../dist/core/index.js";

describe("createChatwootBridge smoke test", () => {
  it("returns a controller with the expected interface", () => {
    const controller = createChatwootBridge({
      baseUrl: "https://chatwoot.kynora.world",
      websiteToken: "test-token",
      loadStrategy: "lazy",
    });

    expect(typeof controller.open).toBe("function");
    expect(typeof controller.close).toBe("function");
    expect(typeof controller.toggle).toBe("function");
    expect(typeof controller.setLocale).toBe("function");
    expect(typeof controller.setUser).toBe("function");
    expect(typeof controller.updateContext).toBe("function");
    expect(typeof controller.on).toBe("function");
    expect(typeof controller.destroy).toBe("function");
    expect(controller.state).toBe("idle");

    controller.destroy();
  });
});
