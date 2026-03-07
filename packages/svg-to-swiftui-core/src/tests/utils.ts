import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const currentDir =
  typeof __dirname !== "undefined"
    ? __dirname
    : dirname(fileURLToPath(import.meta.url));
const contentDirectory = resolve(currentDir, "../../content");

/**
 * Will load a file from `content` directory in the root of
 * the project.
 * @param filename Name of the file to load
 */
export const loadContentFile = (filename: string) =>
  readFileSync(resolve(contentDirectory, filename), "utf8");
