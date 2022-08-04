### A base TSConfig for working with Svelte.

Add the package to your `"devDependencies"`:

```sh
npm install --save-dev @tsconfig/svelte
yarn add --dev @tsconfig/svelte
```

Add to your `tsconfig.json`:

```json
"extends": "@tsconfig/svelte/tsconfig.json"
```

---

The `tsconfig.json`: 

```jsonc
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "display": "Svelte",
  "_version": "3.0.0",

  "compilerOptions": {
    "moduleResolution": "node",
    "target": "es2017",
    /**
      Svelte Preprocess cannot figure out whether you have a value or a type, so tell TypeScript
      to enforce using `import type` instead of `import` for Types.
     */
    "importsNotUsedAsValues": "error",
    /**
      TypeScript doesn't know about import usages in the template because it only sees the
      script of a Svelte file. Therefore preserve all value imports. Requires TS 4.5 or higher.
     */
    "preserveValueImports": true,
    "isolatedModules": true,
    /**
      To have warnings/errors of the Svelte compiler at the correct position,
      enable source maps by default.
     */
    "sourceMap": true,

    "strict": false,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}

```

You can find the [code here](https://github.com/tsconfig/bases/blob/master/bases/svelte.json).
