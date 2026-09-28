import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const revision = "9f31dfa120b37e5a8a649942170b3a2ca8235ff1";
const fixtures = [
  {
    name: "rlcs.replay",
    size: 1072362,
    sha256: "709c0cde2286a1ae0df40de7d58e650371e103f2b4dbf9c8316ac3d53913fc6e",
  },
  {
    name: "rumble.replay",
    size: 1030898,
    sha256: "8669455bfc9c1f86a534a4ac87e14096692eb27e4361cde93973ee5262a53b03",
  },
  {
    name: "epic.replay",
    size: 1131017,
    sha256: "d3ab3c713a6275ad0604954fe3ce58cecb6b63d7753c17a0a7a480add9f8cc74",
  },
];
const folder = new URL("../.local-tests/replays/", import.meta.url);
await mkdir(folder, { recursive: true });

for (const fixture of fixtures) {
  const url = `https://raw.githubusercontent.com/nickbabcock/boxcars/${revision}/assets/replays/good/${fixture.name}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`${fixture.name}: HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length !== fixture.size)
    throw new Error(`${fixture.name}: taille inattendue`);
  const digest = createHash("sha256").update(buffer).digest("hex");
  if (digest !== fixture.sha256)
    throw new Error(`${fixture.name}: SHA-256 inattendu`);
  await writeFile(new URL(fixture.name, folder), buffer);
  console.log(`${fixture.name}: ${buffer.length} bytes, SHA-256 ${digest}`);
}
console.log(`Replays publics de test : ${fileURLToPath(folder)}`);
