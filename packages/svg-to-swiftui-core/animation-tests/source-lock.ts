import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { loadAnimationFixtures } from "./manifest";

export function buildAnimationSourceLock() {
  return {
    version: 1,
    algorithm: "sha256",
    fixtures: loadAnimationFixtures().map((fixture) => ({
      name: fixture.name,
      path: relative(import.meta.dir, fixture.sourcePath).replaceAll("\\", "/"),
      sha256: createHash("sha256").update(readFileSync(fixture.sourcePath)).digest("hex"),
      author: fixture.provenance?.author ?? "SVG to SwiftUI contributors",
      license: fixture.provenance?.license ?? "MIT",
      licenseFile: fixture.provenance?.licenseFile ?? "../../../LICENSE",
      sourceURL:
        fixture.provenance?.sourceURL ??
        `https://github.com/bring-shrubbery/SVG-to-SwiftUI/blob/main/packages/svg-to-swiftui-core/${fixture.relativePath}`,
      upstreamRevision: fixture.provenance?.upstreamRevision ?? "repository",
    })),
  };
}
