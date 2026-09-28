import assert from "node:assert/strict";
import { test } from "node:test";
import {
  uniquePlayerIndex,
  playerTarget,
  reportMatchesTarget,
} from "../src/player.ts";
import { savedProvider } from "../src/providers.ts";

const player = (name, team = 0, isBot = false) => ({
  name,
  team,
  isBot,
  score: 42,
  goals: 1,
  assists: null,
  saves: null,
  shots: 2,
});

test("profile matches only one exact normalized human name", () => {
  const players = [player("You"), player("Other", 1), player("Bot", 1, true)];
  assert.equal(uniquePlayerIndex(players, " YOU "), 0);
  assert.equal(uniquePlayerIndex(players, "Yo"), null);
  assert.equal(uniquePlayerIndex(players, ""), null);
  assert.equal(uniquePlayerIndex(players, "Bot"), null);
  assert.equal(
    uniquePlayerIndex([player("You"), player("YOU", 1)], "you"),
    null,
  );
});
test("selection targets an index, name and team; never first-player fallback", () => {
  const players = [
    player("Duplicate", 0),
    player("Duplicate", 1),
    player("Bot", 1, true),
  ];
  assert.equal(playerTarget(players, null), null);
  assert.equal(playerTarget(players, -1), null);
  assert.equal(playerTarget(players, 1.5), null);
  assert.equal(playerTarget(players, 40), null);
  assert.equal(playerTarget(players, 2), null);
  assert.deepEqual(playerTarget(players, 1), {
    index: 1,
    name: "Duplicate",
    team: 1,
  });
});
test("unknown providers cannot enable network mode", () => {
  assert.equal(savedProvider("openai"), "openai");
  assert.equal(savedProvider("unexpected"), "demo");
  assert.equal(savedProvider("__proto__"), "demo");
});

test("a report cannot appear on another file, player, team or missing target", () => {
  const target = { index: 1, name: "You", team: 0 };
  const report = { player: target };
  assert.equal(reportMatchesTarget(report, "a", "a", target), true);
  assert.equal(reportMatchesTarget(report, "a", "b", target), false);
  assert.equal(
    reportMatchesTarget(report, "a", "a", { ...target, index: 2 }),
    false,
  );
  assert.equal(
    reportMatchesTarget(report, "a", "a", { ...target, name: "Other" }),
    false,
  );
  assert.equal(
    reportMatchesTarget(report, "a", "a", { ...target, team: 1 }),
    false,
  );
  assert.equal(reportMatchesTarget(report, "a", "a", null), false);
  assert.equal(reportMatchesTarget(null, "a", "a", target), false);
});
