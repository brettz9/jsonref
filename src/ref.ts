import * as meta from './meta.js';
import * as pointer from './pointer.js';

const RELATIVE_RE: RegExp = /^#(?:0|[1-9][0-9]*?)(?:$|\/)/;

function deref(obj: any): any {
  let out: any;
  if (obj.$ref.match(RELATIVE_RE)) {
    out = pointer.resolve(obj, obj.$ref.substr(1));
  } else {
    const scope = meta.getMeta(obj).scope;
    const uri = new URL(obj.$ref, scope);
    const path = uri.hash ? uri.hash.substr(1) : undefined;
    uri.hash = '';
    out = meta.getMeta(obj).registry[uri.toString() + '#'];
    if (!out) {
      throw new Error(`Reference not in registry (${uri.toString()})`);
    } else if (path) {
      out = pointer.resolve(out, path);
    }
  }
  return out;
}
export function resolve(obj: any, options: meta.Options): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  return (function _parse(obj: any): any {
    if (!meta.isAnnotated(obj)) {
      obj = meta.annotate(obj, options);
    }
    if (meta.isDerefd(obj)) {
      return obj;
    } else if (meta.isRef(obj)) {
      return deref(obj);
    } else {
      const orig = Object.assign({}, obj);
      Object.defineProperty(obj, 'toJSON', {
        get: () => () => orig,
        enumerable: false,
        configurable: false,
      });
      const keys = Object.keys(obj);
      for (let key of keys) {
        const next = obj[key];
        if (next !== null && typeof next === 'object') {
          if (meta.isRef(next)) {
            Object.defineProperty(obj, key, {
              get: () => {
                Object.defineProperty(obj, key, {
                  value: deref(next),
                  enumerable: true,
                  configurable: true,
                  writable: true,
                });
                return obj[key];
              },
              enumerable: true,
              configurable: true,
            });
          } else {
            obj[key] = _parse(next);
          }
        } else {
          obj[key] = next;
        }
      }
      meta.getMeta(obj).derefd = true;
      return obj;
    }
  })(obj);
}
