import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logger } from "./logger";

describe("logger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const store = new Map<string, string>();
    vi.stubGlobal("window", {
      location: { href: "http://localhost" },
    });
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  describe("development", () => {
    beforeEach(() => {
      vi.stubEnv("NODE_ENV", "development");
      vi.spyOn(console, "debug").mockImplementation(() => {});
      vi.spyOn(console, "info").mockImplementation(() => {});
      vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.spyOn(console, "error").mockImplementation(() => {});
    });

    it("logs debug to console", () => {
      logger.debug("d", { k: 1 });
      expect(console.debug).toHaveBeenCalledWith(
        expect.objectContaining({ level: "debug", message: "d", extra: { k: 1 } })
      );
    });

    it("logs info to console", () => {
      logger.info("i");
      expect(console.info).toHaveBeenCalled();
    });

    it("logs warn to console", () => {
      logger.warn("w");
      expect(console.warn).toHaveBeenCalled();
    });

    it("logs error with stack", () => {
      const err = new Error("boom");
      logger.error("e", err);
      expect(console.error).toHaveBeenCalledWith(
        expect.objectContaining({ level: "error", message: err.message, stack: err.stack })
      );
    });
  });

  describe("production", () => {
    beforeEach(() => {
      vi.stubEnv("NODE_ENV", "production");
      vi.spyOn(console, "info").mockImplementation(() => {});
      vi.spyOn(console, "error").mockImplementation(() => {});
    });

    it("does not log to console", () => {
      logger.info("x");
      expect(console.info).not.toHaveBeenCalled();
    });

    it("POSTs to /api/log", async () => {
      const fetchMock = vi.fn().mockResolvedValue({});
      vi.stubGlobal("fetch", fetchMock);

      logger.info("hello");
      await Promise.resolve();
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/log",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: expect.stringContaining("hello"),
        })
      );
    });

    it("swallows fetch failure", () => {
      vi.stubGlobal("fetch", vi.fn().mockReturnValue({ catch: (fn: () => void) => fn() }));
      expect(() => logger.info("x")).not.toThrow();
    });
  });

  describe("request ID", () => {
    beforeEach(() => {
      vi.stubEnv("NODE_ENV", "development");
      vi.spyOn(console, "info").mockImplementation(() => {});
      vi.stubGlobal("window", {
        location: { href: "http://localhost" },
        __REQUEST_ID__: "req-abc",
      });
    });

    it("captures request ID from window", () => {
      logger.info("x");
      expect(console.info).toHaveBeenCalledWith(
        expect.objectContaining({ requestId: "req-abc" })
      );
    });
  });
});