#!/usr/bin/env node
/**
 * Copyright 2017 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
export interface Logger {
    log: (...args: Array<{}>) => void;
    error: (...args: Array<{}>) => void;
    dir: (obj: {}, options?: {}) => void;
}
export interface Options {
    dryRun: boolean;
    gtsRootDir: string;
    targetRootDir: string;
    yes: boolean;
    no: boolean;
    logger: Logger;
    yarn?: boolean;
}
export declare type VerbFilesFunction = (options: Options, files: string[], fix?: boolean) => Promise<boolean>;
/**
 * Get the current version of node.js being run.
 * Exported purely for stubbing purposes.
 * @private
 */
export declare function getNodeVersion(): string;
export declare function run(verb: string, files: string[]): Promise<boolean>;
