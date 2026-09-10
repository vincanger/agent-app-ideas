import { describe, expect, test } from "vitest";
import { FlipPhysics, TUNING } from "./physics";

function run(p: FlipPhysics, ms: number, dt = 16) {
  for (let t = 0; t < ms; t += dt) p.step(dt);
}

describe("drag", () => {
  test("below the release threshold the page bows and springs back", () => {
    const p = new FlipPhysics(16);
    p.dragStart();
    p.dragTo(0.3);
    expect(p.currentPage).toBe(0);
    expect(p.snapshot().tension).toBeCloseTo(0.3 / TUNING.RELEASE_AT, 5);
    expect(p.snapshot().inFlight).toHaveLength(0);
    p.release(0);
    run(p, 1000);
    expect(p.snapshot().tension).toBe(0);
    expect(p.currentPage).toBe(0);
  });

  test("crossing the threshold releases exactly one flight", () => {
    const p = new FlipPhysics(16);
    p.dragStart();
    p.dragTo(0.7);
    expect(p.currentPage).toBe(1);
    const { inFlight } = p.snapshot();
    expect(inFlight).toHaveLength(1);
    expect(inFlight[0]).toMatchObject({ index: 0, dir: 1 });
  });

  test("a long drag releases one flight per page passed", () => {
    const p = new FlipPhysics(16);
    p.dragStart();
    p.dragTo(3.2);
    expect(p.currentPage).toBe(3);
    expect(p.snapshot().inFlight.map((f) => f.index)).toEqual([0, 1, 2]);
  });

  test("dragging back lifts pages off the top pile", () => {
    const p = new FlipPhysics(16);
    p.jumpTo(5);
    p.dragStart();
    p.dragTo(3.9);
    expect(p.currentPage).toBe(4);
    expect(p.snapshot().inFlight[0]).toMatchObject({ index: 4, dir: -1 });
  });

  test("bows but cannot release at the covers", () => {
    const p = new FlipPhysics(4);
    p.jumpTo(3);
    p.dragStart();
    p.dragTo(9);
    expect(p.currentPage).toBe(3);
    expect(p.snapshot().inFlight).toHaveLength(0);
    // the cover bows all the way but never releases
    expect(p.snapshot().tension).toBeGreaterThan(0.9);
    expect(p.snapshot().tension).toBeLessThanOrEqual(1);
    p.dragTo(3.4);
    expect(p.snapshot().tension).toBeCloseTo(0.4 / TUNING.RELEASE_AT, 5);
    expect(p.currentPage).toBe(3);
    // and the same at the front cover
    p.dragTo(-9);
    expect(p.currentPage).toBe(0);
    expect(p.snapshot().tension).toBeLessThan(-0.9);
  });
});

describe("flights", () => {
  test("always settle flat", () => {
    const p = new FlipPhysics(16);
    p.stepPage(1);
    run(p, 3000);
    expect(p.snapshot().inFlight).toHaveLength(0);
    expect(p.currentPage).toBe(1);
  });

  test("overshoot past flat before settling", () => {
    const p = new FlipPhysics(16);
    p.stepPage(1);
    let maxT = 0;
    for (let i = 0; i < 200; i++) {
      p.step(8);
      const f = p.snapshot().inFlight[0];
      if (f) maxT = Math.max(maxT, f.t);
    }
    expect(maxT).toBeGreaterThan(1);
    expect(maxT).toBeLessThan(1.3);
  });
});

describe("riffle", () => {
  test("a flick spawns flights spaced by at least MIN_FLIGHT_GAP", () => {
    const p = new FlipPhysics(16);
    p.dragStart();
    p.dragTo(0.1);
    p.release(0.02); // 20 pages/s
    const spawnTimes: number[] = [];
    let seen = new Set<number>();
    let clock = 0;
    for (let i = 0; i < 700; i++) {
      p.step(4);
      clock += 4;
      for (const f of p.snapshot().inFlight) {
        if (!seen.has(f.index)) {
          seen.add(f.index);
          spawnTimes.push(clock);
        }
      }
    }
    expect(spawnTimes.length).toBeGreaterThan(2);
    for (let i = 1; i < spawnTimes.length; i++) {
      expect(spawnTimes[i] - spawnTimes[i - 1]).toBeGreaterThanOrEqual(TUNING.MIN_FLIGHT_GAP);
    }
    expect(p.snapshot().mode).toBe("idle");
    expect(p.currentPage).toBeGreaterThan(2);
  });

  test("stops at the back cover", () => {
    const p = new FlipPhysics(6);
    p.dragStart();
    p.dragTo(0.1);
    p.release(0.05);
    run(p, 3000);
    expect(p.currentPage).toBe(5);
    expect(p.snapshot().mode).toBe("idle");
    expect(p.snapshot().inFlight).toHaveLength(0);
  });

  test("a slow release does not riffle", () => {
    const p = new FlipPhysics(16);
    p.dragStart();
    p.dragTo(0.2);
    p.release(0.00001);
    expect(p.snapshot().mode).toBe("idle");
    run(p, 1000);
    expect(p.currentPage).toBe(0);
  });
});

describe("play", () => {
  test("12 fps releases 12 pages per second", () => {
    const p = new FlipPhysics(48);
    p.playAt(12);
    run(p, 1000);
    expect(p.currentPage).toBe(12);
  });

  test("wraps to the first page at the end", () => {
    const p = new FlipPhysics(4);
    p.playAt(10);
    run(p, 450); // 4 releases: 0→1→2→3→wrap
    expect(p.currentPage).toBe(0);
  });

  test("in-flight pages are capped", () => {
    const p = new FlipPhysics(48);
    p.playAt(24);
    run(p, 500);
    expect(p.snapshot().inFlight.length).toBeLessThanOrEqual(TUNING.MAX_IN_FLIGHT);
  });
});

describe("page count changes", () => {
  test("frames streaming in keep the position valid", () => {
    const p = new FlipPhysics(16);
    p.jumpTo(15);
    p.setPageCount(8);
    expect(p.currentPage).toBe(7);
    p.setPageCount(16);
    expect(p.currentPage).toBe(7);
  });
});
