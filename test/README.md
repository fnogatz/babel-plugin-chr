# Tests

The original [`CHR.js` repository](https://github.com/fnogatz/CHR.js) already provides tests for its just-in-time (JIT) compilation. We use the same by precompiling (so called ahead-of-time compilation, AOT) them with the help of the `babel-plugin-chr`. If the precompiled tests still succeed, our implementation is conform to `CHR.js`' JIT semantics.

## Run tests

In the project's root directory:

	npm run tape

## Fetch original tests

In the project's root directory:

	npm run fetch-tests

This will copy the files located in [`/node_modules/chr/test/jit-compilation`](https://github.com/fnogatz/CHR.js/tree/master/test/jit-compilation) into `/test` and corrects the references to the `chr` module.
