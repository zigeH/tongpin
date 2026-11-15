import { ConvexError } from "convex/values";
import { describe, expect, test } from "vitest";
import { EDIT_FIELDS, OPENED_FIELDS, errorCode, expectCode, isGlb, presentFields, runSteps, type Step } from "../scripts/e2e";

describe("e2e helpers", () => {
  test("errorCode reads ConvexError data", () => {
    expect(errorCode(new ConvexError({ code: "NOT_SENDER", message: "x" }))).toBe("NOT_SENDER");
    expect(errorCode(new Error("plain"))).toBeUndefined();
  });

  test("expectCode passes on the right code and fails otherwise", async () => {
    await expect(expectCode(Promise.reject(new ConvexError({ code: "WRONG_STATUS", message: "" })), "WRONG_STATUS")).resolves.toBeUndefined();
    await expect(expectCode(Promise.reject(new ConvexError({ code: "WRONG_STATUS", message: "" })), "NOT_SENDER")).rejects.toThrow(/NOT_SENDER/);
    await expect(expectCode(Promise.resolve(null), "NOT_SENDER")).rejects.toThrow(/实际成功了/);
  });

  test("presentFields finds leaked edit fields", () => {
    expect(presentFields({ code: "123456", prompt: "hi", sealedAt: 1 }, EDIT_FIELDS)).toEqual(["prompt", "sealedAt"]);
    expect(presentFields({ code: "123456" }, EDIT_FIELDS)).toEqual([]);
    expect(OPENED_FIELDS).not.toContain("editError");
  });

  test("isGlb checks the glTF magic", () => {
    const glb = new Uint8Array(20);
    glb.set(new TextEncoder().encode("glTF"));
    expect(isGlb(glb)).toBe(true);
    expect(isGlb(new TextEncoder().encode("<html>not a model</html>"))).toBe(false);
  });
});

describe("runSteps", () => {
  test("records pass, fail, and skips steps whose inputs are missing", async () => {
    type C = { a?: number; b?: number };
    const steps: Step<C>[] = [
      { name: "set a", run: async (ctx) => void (ctx.a = 1) },
      { name: "fail before b", needs: ["a"], run: async () => { throw new Error("boom"); } },
      { name: "needs b", needs: ["b"], run: async () => {} },
      { name: "needs a", needs: ["a"], run: async () => {} },
    ];
    const lines: string[] = [];
    const results = await runSteps<C>({}, steps, (line) => lines.push(line));
    expect(results.map((r) => r.status)).toEqual(["pass", "fail", "skip", "pass"]);
    expect(results[1].detail).toBe("boom");
    expect(results[2].detail).toContain("b");
    expect(lines).toHaveLength(4);
  });
});
