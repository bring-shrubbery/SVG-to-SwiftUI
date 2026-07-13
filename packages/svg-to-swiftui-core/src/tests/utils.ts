import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const contentDirectory = resolve(__dirname, "../../content");

/**
 * Will load a file from `content` directory in the root of
 * the project.
 * @param filename Name of the file to load
 */
export const loadContentFile = (filename: string) => readFileSync(resolve(contentDirectory, filename), "utf8");
