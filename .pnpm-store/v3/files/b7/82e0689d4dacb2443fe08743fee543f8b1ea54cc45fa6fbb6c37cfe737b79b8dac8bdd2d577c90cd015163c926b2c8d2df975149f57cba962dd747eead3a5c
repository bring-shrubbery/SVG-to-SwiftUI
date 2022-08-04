/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import type { Config } from '@jest/types';
declare type OldCacheKeyOptions = {
    config: Config.ProjectConfig;
    instrument: boolean;
};
declare type NewCacheKeyOptions = {
    config: Config.ProjectConfig;
    configString: string;
    instrument: boolean;
};
declare type OldGetCacheKeyFunction = (fileData: string, filePath: Config.Path, configStr: string, options: OldCacheKeyOptions) => string;
declare type NewGetCacheKeyFunction = (sourceText: string, sourcePath: Config.Path, options: NewCacheKeyOptions) => string;
declare type GetCacheKeyFunction = OldGetCacheKeyFunction | NewGetCacheKeyFunction;
export default function createCacheKey(files?: Array<string>, values?: Array<string>): GetCacheKeyFunction;
export {};
