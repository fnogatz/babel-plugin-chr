# babel-plugin-chr

Babel plugin that precompiles [CHR.js](https://github.com/fnogatz/CHR.js) source code.

## Install

```sh
npm install babel-plugin-chr
```

## Usage

Run:

```sh
babel --plugins chr script.js
```

Or add the plugin to your `.babelrc` configuration:

```json
{
  "plugins": [ "chr" ]
}
```

## Example

The plugin will compile the following code:

```js
var CHR = require('chr')
var chr = new CHR()

chr('some @ a ==> b')
```

into:

```js
var _Runtime = require('chr/runtime');
var chr = {
  Store: new _Runtime.Store(),
  History: new _Runtime.History(),
  Constraints: {},
  Replacements: []
};

chr = (function (chr) {
  chr.a = _Runtime.Helper.dynamicCaller('a');
  chr.Constraints['a/0'] = [];
  chr.b = _Runtime.Helper.dynamicCaller('b');
  chr.Constraints['b/0'] = [];

  chr.Constraints['a/0'][0] = function (constraint) {
    var self = this;
    var ids = [constraint.id];

    if (ids.every(function (id) {
      return self.Store.alive(id);
    })) {
      if (_Runtime.Helper.allDifferent(ids)) {
        if (self.History.notIn('some', ids)) {
          self.History.add('some', ids);
          self.b();
        }
      }
    }
  };

  return chr;
})(chr);
```

It supports the normal `CHR.js` syntax as specified here: [fnogatz/CHR.js](https://github.com/fnogatz/CHR.js)
