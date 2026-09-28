import assert from "node:assert/strict";
import { test } from "node:test";
import {
  emptyConfiguration,
  configurationReady,
  catalogConfiguration,
  confirmedModel,
} from "../src/aiConfiguration.ts";

const catalog = [{ id: "example-model-001", label: "Example" }];
test("typing a key cannot enable real analysis", () => {
  const draft = emptyConfiguration("fake-key");
  assert.equal(configurationReady("gemini", draft), false);
  assert.equal(configurationReady("demo", draft), true);
  assert.equal(confirmedModel(draft), null);
});
test("catalog retrieval never silently saves a remembered model", () => {
  const config = catalogConfiguration("fake-key", catalog, "example-model-001");
  assert.equal(config.choice, "example-model-001");
  assert.equal(config.model, "");
  assert.equal(configurationReady("gemini", config), false);
  assert.equal(confirmedModel(config), "example-model-001");
  assert.equal(
    configurationReady("gemini", { ...config, model: confirmedModel(config) }),
    true,
  );
});
test("unavailable saved IDs and arbitrary choices cannot be confirmed", () => {
  const config = catalogConfiguration("fake-key", catalog, "old-model");
  assert.equal(config.choice, "");
  assert.equal(confirmedModel({ ...config, choice: "invented-model" }), null);
  assert.equal(
    configurationReady("openai", { ...config, model: "invented-model" }),
    false,
  );
});
test("editing or forgetting a key removes its catalog and saved readiness", () => {
  const config = {
    ...catalogConfiguration("fake-key", catalog, "example-model-001"),
    model: "example-model-001",
  };
  assert.equal(configurationReady("claude", config), true);
  for (const edited of [
    emptyConfiguration("replacement"),
    emptyConfiguration(),
  ]) {
    assert.equal(configurationReady("claude", edited), false);
    assert.deepEqual(edited.catalog, []);
    assert.equal(edited.apiKey, "");
    assert.equal(edited.model, "");
  }
});
