"use strict";
import { createRequire } from 'module';
import { pathToFileURL } from 'url';
let require = createRequire(import.meta.url);

/**
 * 
 * @param {string} filePath 
 */
export default async function requireOrImport(filePath, { middleware = [] } = {}) {
    await Promise.all(middleware.map(plugin => plugin.register(filePath)));

    return new Promise((resolve, reject) => {
        try {
            let mdl = require(filePath);
            resolve(mdl);
        } catch (e) {
            if (e.code === 'ERR_REQUIRE_ESM') {
                const fileUrl = pathToFileURL(filePath).toString();
                return import(fileUrl).then(mdl => resolve(mdl));
            };
            reject(e);
        }
    })
}
