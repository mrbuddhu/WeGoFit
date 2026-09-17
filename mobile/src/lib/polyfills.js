// Polyfill crypto.getRandomValues for Supabase auth (signUp uses it for PKCE/nonce generation)
// Preserves any existing crypto properties (e.g. subtle) rather than clobbering the object.
// Also tests if the native implementation actually works — Hermes can expose getRandomValues
// as a function but have it throw at runtime, which a typeof check won't catch.
if (typeof global.crypto === "undefined") {
  global.crypto = {};
}
(function patchGetRandomValues() {
  function syntheticGetRandomValues(buf) {
    for (let i = 0; i < buf.length; i++) buf[i] = Math.floor(Math.random() * 256);
    return buf;
  }
  if (typeof global.crypto.getRandomValues !== "function") {
    global.crypto.getRandomValues = syntheticGetRandomValues;
  } else {
    try {
      global.crypto.getRandomValues(new Uint8Array(1));
    } catch (_e) {
      global.crypto.getRandomValues = syntheticGetRandomValues;
    }
  }
}());

// Polyfill for Supabase in Expo Snack
if (typeof global.URL === "undefined") {
  global.URL = class URL {
    constructor(url, base) {
      const full = base
        ? base.replace(/\/$/, "") + "/" + url.replace(/^\//, "")
        : url;
      this.href     = full;
      this.origin   = full.split("/").slice(0, 3).join("/");
      this.pathname = "/" + full.split("/").slice(3).join("/");
      this.search   = "";
      this.hash     = "";
      this.host     = full.split("/")[2] || "";
      this.hostname = this.host.split(":")[0];
      this.protocol = full.split(":")[0] + ":";
    }
    toString() { return this.href; }
  };
}

if (typeof global.URLSearchParams === "undefined") {
  global.URLSearchParams = class {
    constructor(init) {
      this._params = {};
      if (typeof init === "string") {
        init.replace(/^\?/, "").split("&").forEach(pair => {
          const [k, v] = pair.split("=");
          if (k) this._params[decodeURIComponent(k)] = decodeURIComponent(v || "");
        });
      }
    }
    get(key)      { return this._params[key] || null; }
    set(key, val) { this._params[key] = val; }
    toString() {
      return Object.entries(this._params)
        .map(([k, v]) => encodeURIComponent(k) + "=" + encodeURIComponent(v))
        .join("&");
    }
  };
}
