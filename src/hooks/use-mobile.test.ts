import { describe, expect, it } from "vitest";
import { isMobileViewport, MOBILE_BREAKPOINT, MOBILE_MEDIA_QUERY } from "./use-mobile";

describe("use-mobile contract", () => {
  it("uses the shared 768px breakpoint", () => {
    expect(MOBILE_BREAKPOINT).toBe(768);
    expect(MOBILE_MEDIA_QUERY).toBe("(max-width: 767px)");
  });

  it("classifies mobile and desktop viewport boundaries", () => {
    expect(isMobileViewport(320)).toBe(true);
    expect(isMobileViewport(767)).toBe(true);
    expect(isMobileViewport(768)).toBe(false);
    expect(isMobileViewport(1440)).toBe(false);
  });
});
