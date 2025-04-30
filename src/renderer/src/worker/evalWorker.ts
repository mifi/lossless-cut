import type { RequestMessageData, ResponseMessageData } from './eval';


// https://stackoverflow.com/a/10796616/6519037
// https://github.com/Zirak/SO-ChatBot/blob/master/source/eval.js
// https://github.com/Zirak/SO-ChatBot/blob/master/source/codeWorker.js

// `this` doesn't seem to work when transpiling, so use globalThis instead
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/globalThis
const myGlobal = globalThis;


const wl = {
  self: 1,
  onmessage: 1,
  postMessage: 1,
  global: 1,
  wl: 1,
  eval: 1,
  Array: 1,
  Boolean: 1,
  Date: 1,
  Function: 1,
  Number: 1,
  Object: 1,
  RegExp: 1,
  String: 1,
  Error: 1,
  EvalError: 1,
  RangeError: 1,
  ReferenceError: 1,
  SyntaxError: 1,
  TypeError: 1,
  URIError: 1,
  decodeURI: 1,
  decodeURIComponent: 1,
  encodeURI: 1,
  encodeURIComponent: 1,
  isFinite: 1,
  isNaN: 1,
  parseFloat: 1,
  parseInt: 1,
  Infinity: 1,
  JSON: 1,
  Math: 1,
  NaN: 1,
  undefined: 1,

  // Chrome errors if you attempt to write over either of these properties, so put them in the whitelist
  // https://github.com/owl-factory/lantern/blob/addda28034d5d30a7ea720646aa56fefa8f05cf4/archive/src/nodes/sandbox/workers/sandboxed-code.worker.ts#L47
  TEMPORARY: 1,
  PERSISTENT: 1,
};

// eslint-disable-next-line prefer-arrow-callback, func-names
Object.getOwnPropertyNames(myGlobal).forEach(function (prop) {
  // eslint-disable-next-line no-prototype-builtins
  if (!wl.hasOwnProperty(prop)) {
    Object.defineProperty(myGlobal, prop, {
      // eslint-disable-next-line func-names, object-shorthand
      get: function () {
        // eslint-disable-next-line no-throw-literal
        throw `Security Exception: cannot access ${prop}`;
      },
      configurable: false,
    });
  }
});

// @ts-expect-error dunno
// eslint-disable-next-line no-proto, prefer-arrow-callback, func-names
Object.getOwnPropertyNames(myGlobal.__proto__).forEach(function (prop) {
  // eslint-disable-next-line no-prototype-builtins
  if (!wl.hasOwnProperty(prop)) {
    // @ts-expect-error dunno
    // eslint-disable-next-line no-proto
    Object.defineProperty(myGlobal.__proto__, prop, {
      // eslint-disable-next-line func-names, object-shorthand
      get: function () {
        // eslint-disable-next-line no-throw-literal
        throw `Security Exception: cannot access ${prop}`;
      },
      configurable: false,
    });
  }
});

// Array(5000000000).join("adasdadadasd") instantly crashing some browser tabs
// eslint-disable-next-line no-extend-native
Object.defineProperty(Array.prototype, 'join', {
  writable: false,
  configurable: false,
  enumerable: false,
  // eslint-disable-next-line wrap-iife, func-names
  value: function (old) {
    // eslint-disable-next-line func-names
    return function (arg?: unknown[]) {
      // @ts-expect-error dunno how to fix
      if (this.length > 500 || (arg && arg.length > 500)) {
        // eslint-disable-next-line no-throw-literal
        throw 'Exception: too many items';
      }

      // @ts-expect-error dunno how to fix
      // eslint-disable-next-line unicorn/prefer-reflect-apply, prefer-rest-params
      return old.apply(this, arguments);
    };
  }(Array.prototype.join),
});


/*
  https://github.com/Zirak/SO-ChatBot/blob/accbfb4b8738781afaf4f080a6bb0337e13f7c25/source/codeWorker.js#L87

  DOM specification doesn't define an enumerable `fetch` function object on
  the global object so we add the property here, and the following code will
  blacklist it. (`fetch` descends from `GlobalFetch`, and is thus present in
  worker code as well)
  Just in case someone runs the bot on some old browser where `fetch` is not
  defined anyways, this will have no effect.
  Reason for blacklisting fetch: well, same as XHR.
*/
// @ts-expect-error expected
myGlobal.fetch = undefined;


// eslint-disable-next-line wrap-iife, func-names
(function () {
  onmessage = (event: MessageEvent<RequestMessageData>) => {
    // eslint-disable-next-line strict, lines-around-directive
    'use strict';

    const { code, id, context: contextStr } = event.data;
    const context = { ...JSON.parse(contextStr) };

    try {
      // https://stackoverflow.com/questions/8403108/calling-eval-in-particular-context
      // eslint-disable-next-line unicorn/new-for-builtins, no-new-func
      const result = Function(`\nwith (this) { return (${code}); }`).call(context);
      postMessage({ id, data: result } satisfies ResponseMessageData);
    } catch (e) {
      postMessage({ id, error: `${e}` } satisfies ResponseMessageData);
    }
  };
})();
