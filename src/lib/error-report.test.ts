import { describe, it, expect, beforeEach, vi } from "vitest";
import { reportClientError } from "./error-report";

function beacons() {
  return (navigator.sendBeacon as unknown as ReturnType<typeof vi.fn>).mock.calls;
}

beforeEach(() => {
  Object.defineProperty(navigator, "sendBeacon", {
    value: vi.fn(() => true),
    configurable: true,
    writable: true,
  });
});

describe("reportClientError", () => {
  it("sends the error to the ingest endpoint", () => {
    reportClientError(new Error(`boom-${Math.random()}`));
    expect(beacons()).toHaveLength(1);
    expect(beacons()[0][0]).toBe("/api/public/hooks/errors");
  });

  it("deduplicates identical errors within the dedupe window", () => {
    const err = new Error(`dupe-${Math.random()}`);
    reportClientError(err);
    reportClientError(err);
    reportClientError(err);
    expect(beacons()).toHaveLength(1);
  });

  it("never throws on malformed input", () => {
    expect(() => reportClientError(undefined)).not.toThrow();
    expect(() => reportClientError({ weird: true })).not.toThrow();
  });
});
