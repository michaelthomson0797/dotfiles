if (typeof JSON !== "object") {
    JSON = {}
}(function() {
    "use strict";

    function f(n) {
        return n < 10 ? "0" + n : n
    }
    if (typeof Date.prototype.toJSON !== "function") {
        Date.prototype.toJSON = function() {
            return isFinite(this.valueOf()) ? this.getUTCFullYear() + "-" + f(this.getUTCMonth() + 1) + "-" + f(this.getUTCDate()) + "T" + f(this.getUTCHours()) + ":" + f(this.getUTCMinutes()) + ":" + f(this.getUTCSeconds()) + "Z" : null
        };
        String.prototype.toJSON = Number.prototype.toJSON = Boolean.prototype.toJSON = function() {
            return this.valueOf()
        }
    }
    var cx, escapable, gap, indent, meta, rep;

    function quote(string) {
        escapable.lastIndex = 0;
        return escapable.test(string) ? '"' + string.replace(escapable, function(a) {
            var c = meta[a];
            return typeof c === "string" ? c : "\\u" + ("0000" + a.charCodeAt(0).toString(16)).slice(-4)
        }) + '"' : '"' + string + '"'
    }

    function str(key, holder) {
        var i, k, v, length, mind = gap,
            partial, value = holder[key];
        if (value && typeof value === "object" && typeof value.toJSON === "function") {
            value = value.toJSON(key)
        }
        if (typeof rep === "function") {
            value = rep.call(holder, key, value)
        }
        switch (typeof value) {
            case "string":
                return quote(value);
            case "number":
                return isFinite(value) ? String(value) : "null";
            case "boolean":
            case "null":
                return String(value);
            case "object":
                if (!value) {
                    return "null"
                }
                gap += indent;
                partial = [];
                if (Object.prototype.toString.apply(value) === "[object Array]") {
                    length = value.length;
                    for (i = 0; i < length; i += 1) {
                        partial[i] = str(i, value) || "null"
                    }
                    v = partial.length === 0 ? "[]" : gap ? "[\n" + gap + partial.join(",\n" + gap) + "\n" + mind + "]" : "[" + partial.join(",") + "]";
                    gap = mind;
                    return v
                }
                if (rep && typeof rep === "object") {
                    length = rep.length;
                    for (i = 0; i < length; i += 1) {
                        if (typeof rep[i] === "string") {
                            k = rep[i];
                            v = str(k, value);
                            if (v) {
                                partial.push(quote(k) + (gap ? ": " : ":") + v)
                            }
                        }
                    }
                } else {
                    for (k in value) {
                        if (Object.prototype.hasOwnProperty.call(value, k)) {
                            v = str(k, value);
                            if (v) {
                                partial.push(quote(k) + (gap ? ": " : ":") + v)
                            }
                        }
                    }
                }
                v = partial.length === 0 ? "{}" : gap ? "{\n" + gap + partial.join(",\n" + gap) + "\n" + mind + "}" : "{" + partial.join(",") + "}";
                gap = mind;
                return v
        }
    }
    if (typeof JSON.stringify !== "function") {
        escapable = /[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g;
        meta = {
            "\b": "\\b",
            "	": "\\t",
            "\n": "\\n",
            "\f": "\\f",
            "\r": "\\r",
            '"': '\\"',
            "\\": "\\\\"
        };
        JSON.stringify = function(value, replacer, space) {
            var i;
            gap = "";
            indent = "";
            if (typeof space === "number") {
                for (i = 0; i < space; i += 1) {
                    indent += " "
                }
            } else if (typeof space === "string") {
                indent = space
            }
            rep = replacer;
            if (replacer && typeof replacer !== "function" && (typeof replacer !== "object" || typeof replacer.length !== "number")) {
                throw new Error("JSON.stringify")
            }
            return str("", {
                "": value
            })
        }
    }
    if (typeof JSON.parse !== "function") {
        cx = /[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g;
        JSON.parse = function(text, reviver) {
            var j;

            function walk(holder, key) {
                var k, v, value = holder[key];
                if (value && typeof value === "object") {
                    for (k in value) {
                        if (Object.prototype.hasOwnProperty.call(value, k)) {
                            v = walk(value, k);
                            if (v !== undefined) {
                                value[k] = v
                            } else {
                                delete value[k]
                            }
                        }
                    }
                }
                return reviver.call(holder, key, value)
            }
            text = String(text);
            cx.lastIndex = 0;
            if (cx.test(text)) {
                text = text.replace(cx, function(a) {
                    return "\\u" + ("0000" + a.charCodeAt(0).toString(16)).slice(-4)
                })
            }
            if (/^[\],:{}\s]*$/.test(text.replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g, "@").replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, "]").replace(/(?:^|:|,)(?:\s*\[)+/g, ""))) {
                j = eval("(" + text + ")");
                return typeof reviver === "function" ? walk({
                    "": j
                }, "") : j
            }
            throw new SyntaxError("JSON.parse")
        }
    }
})();
(function() {
    var namespace = "StripeCheckout.require".split("."),
        name = namespace[namespace.length - 1],
        base = this,
        i;
    for (i = 0; i < namespace.length - 1; i++) {
        base = base[namespace[i]] = base[namespace[i]] || {}
    }
    if (base[name] === undefined) {
        base[name] = function() {
            var modules = {},
                cache = {};
            var requireRelative = function(name, root) {
                var path = expand(root, name),
                    indexPath = expand(path, "./index"),
                    module, fn;
                module = cache[path] || cache[indexPath];
                if (module) {
                    return module
                } else if (fn = modules[path] || modules[path = indexPath]) {
                    module = {
                        id: path,
                        exports: {}
                    };
                    cache[path] = module.exports;
                    fn(module.exports, function(name) {
                        return require(name, dirname(path))
                    }, module);
                    return cache[path] = module.exports
                } else {
                    throw "module " + name + " not found"
                }
            };
            var expand = function(root, name) {
                var results = [],
                    parts, part;
                if (/^\.\.?(\/|$)/.test(name)) {
                    parts = [root, name].join("/").split("/")
                } else {
                    parts = name.split("/")
                }
                for (var i = 0, length = parts.length; i < length; i++) {
                    part = parts[i];
                    if (part == "..") {
                        results.pop()
                    } else if (part != "." && part != "") {
                        results.push(part)
                    }
                }
                return results.join("/")
            };
            var dirname = function(path) {
                return path.split("/").slice(0, -1).join("/")
            };
            var require = function(name) {
                return requireRelative(name, "")
            };
            require.define = function(bundle) {
                for (var key in bundle) {
                    modules[key] = bundle[key]
                }
            };
            require.modules = modules;
            require.cache = cache;
            return require
        }.call()
    }
})();
StripeCheckout.require.define({
    "vendor/cookie": function(exports, require, module) {
        var cookie = {};
        var pluses = /\+/g;

        function extend(target, other) {
            target = target || {};
            for (var prop in other) {
                if (typeof source[prop] === "object") {
                    target[prop] = extend(target[prop], source[prop])
                } else {
                    target[prop] = source[prop]
                }
            }
            return target
        }

        function raw(s) {
            return s
        }

        function decoded(s) {
            return decodeURIComponent(s.replace(pluses, " "))
        }

        function converted(s) {
            if (s.indexOf('"') === 0) {
                s = s.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\")
            }
            try {
                return config.json ? JSON.parse(s) : s
            } catch (er) {}
        }
        var config = cookie.set = cookie.get = function(key, value, options) {
            if (value !== undefined) {
                options = extend(options, config.defaults);
                if (typeof options.expires === "number") {
                    var days = options.expires,
                        t = options.expires = new Date;
                    t.setDate(t.getDate() + days)
                }
                value = config.json ? JSON.stringify(value) : String(value);
                return document.cookie = [config.raw ? key : encodeURIComponent(key), "=", config.raw ? value : encodeURIComponent(value), options.expires ? "; expires=" + options.expires.toUTCString() : "", options.path ? "; path=" + options.path : "", options.domain ? "; domain=" + options.domain : "", options.secure ? "; secure" : ""].join("")
            }
            var decode = config.raw ? raw : decoded;
            var cookies = document.cookie.split("; ");
            var result = key ? undefined : {};
            for (var i = 0, l = cookies.length; i < l; i++) {
                var parts = cookies[i].split("=");
                var name = decode(parts.shift());
                var cookie = decode(parts.join("="));
                if (key && key === name) {
                    result = converted(cookie);
                    break
                }
                if (!key) {
                    result[name] = converted(cookie)
                }
            }
            return result
        };
        config.defaults = {};
        cookie.remove = function(key, options) {
            if (cookie.get(key) !== undefined) {
                cookie.set(key, "", extend(options, {
                    expires: -1
                }));
                return true
            }
            return false
        };
        module.exports = cookie
    }
});
StripeCheckout.require.define({
    "vendor/ready": function(exports, require, module) {
        ! function(name, definition) {
            if (typeof module != "undefined") module.exports = definition();
            else if (typeof define == "function" && typeof define.amd == "object") define(definition);
            else this[name] = definition()
        }("domready", function(ready) {
            var fns = [],
                fn, f = false,
                doc = document,
                testEl = doc.documentElement,
                hack = testEl.doScroll,
                domContentLoaded = "DOMContentLoaded",
                addEventListener = "addEventListener",
                onreadystatechange = "onreadystatechange",
                readyState = "readyState",
                loadedRgx = hack ? /^loaded|^c/ : /^loaded|c/,
                loaded = loadedRgx.test(doc[readyState]);

            function flush(f) {
                loaded = 1;
                while (f = fns.shift()) f()
            }
            doc[addEventListener] && doc[addEventListener](domContentLoaded, fn = function() {
                doc.removeEventListener(domContentLoaded, fn, f);
                flush()
            }, f);
            hack && doc.attachEvent(onreadystatechange, fn = function() {
                if (/^c/.test(doc[readyState])) {
                    doc.detachEvent(onreadystatechange, fn);
                    flush()
                }
            });
            return ready = hack ? function(fn) {
                self != top ? loaded ? fn() : fns.push(fn) : function() {
                    try {
                        testEl.doScroll("left")
                    } catch (e) {
                        return setTimeout(function() {
                            ready(fn)
                        }, 50)
                    }
                    fn()
                }()
            } : function(fn) {
                loaded ? fn() : fns.push(fn)
            }
        })
    }
});
(function() {
    if (!Array.prototype.indexOf) {
        Array.prototype.indexOf = function(obj, start) {
            var f, i, j, _i;
            j = this.length;
            f = start ? start : 0;
            for (i = _i = f; f <= j ? _i < j : _i > j; i = f <= j ? ++_i : --_i) {
                if (this[i] === obj) {
                    return i
                }
            }
            return -1
        }
    }
}).call(this);
StripeCheckout.require.define({
    "lib/helpers": function(exports, require, module) {
        (function() {
            var delurkWinPhone, helpers, uaVersionFn;
            uaVersionFn = function(re) {
                return function() {
                    var uaMatch;
                    uaMatch = helpers.userAgent.match(re);
                    return uaMatch && parseInt(uaMatch[1])
                }
            };
            delurkWinPhone = function(fn) {
                return function() {
                    return fn() && !helpers.isWindowsPhone()
                }
            };
            helpers = {
                userAgent: window.navigator.userAgent,
                escape: function(value) {
                    return value && ("" + value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;")
                },
                trim: function(value) {
                    return value.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, "")
                },
                sanitizeURL: function(value) {
                    var SCHEME_WHITELIST, allowed, scheme, _i, _len;
                    if (!value) {
                        return
                    }
                    value = helpers.trim(value);
                    SCHEME_WHITELIST = ["data:", "http:", "https:"];
                    allowed = false;
                    for (_i = 0, _len = SCHEME_WHITELIST.length; _i < _len; _i++) {
                        scheme = SCHEME_WHITELIST[_i];
                        if (value.indexOf(scheme) === 0) {
                            allowed = true;
                            break
                        }
                    }
                    if (!allowed) {
                        return null
                    }
                    return encodeURI(value)
                },
                iOSVersion: uaVersionFn(/(?:iPhone OS |iPad; CPU OS )(\d+)_\d+/),
                iOSMinorVersion: uaVersionFn(/(?:iPhone OS |iPad; CPU OS )\d+_(\d+)/),
                iOSBuildVersion: uaVersionFn(/(?:iPhone OS |iPad; CPU OS )\d+_\d+_(\d+)/),
                androidWebkitVersion: uaVersionFn(/Mozilla\/5\.0.*Android.*AppleWebKit\/([\d]+)/),
                androidVersion: uaVersionFn(/Android (\d+)\.\d+/),
                firefoxVersion: uaVersionFn(/Firefox\/(\d+)\.\d+/),
                chromeVersion: uaVersionFn(/Chrome\/(\d+)\.\d+/),
                safariVersion: uaVersionFn(/Version\/(\d+)\.\d+ Safari/),
                iOSChromeVersion: uaVersionFn(/CriOS\/(\d+)\.\d+/),
                iOSNativeVersion: uaVersionFn(/Stripe\/(\d+)\.\d+/),
                ieVersion: uaVersionFn(/(?:MSIE |Trident\/.*rv:)(\d{1,2})\./),
                isiOSChrome: function() {
                    return /CriOS/.test(helpers.userAgent)
                },
                isiOSWebView: function() {
                    return /(iPhone|iPod|iPad).*AppleWebKit((?!.*Safari)|(.*\([^)]*like[^)]*Safari[^)]*\)))/i.test(helpers.userAgent)
                },
                getiOSWebViewType: function() {
                    if (helpers.isiOSWebView()) {
                        if (window.indexedDB) {
                            return "WKWebView"
                        } else {
                            return "UIWebView"
                        }
                    }
                },
                isiOS: delurkWinPhone(function() {
                    return /(iPhone|iPad|iPod)/i.test(helpers.userAgent)
                }),
                isiOSNative: function() {
                    return this.isiOS() && this.iOSNativeVersion() >= 3
                },
                isiPad: function() {
                    return /(iPad)/i.test(helpers.userAgent)
                },
                isMac: delurkWinPhone(function() {
                    return /mac/i.test(helpers.userAgent)
                }),
                isWindowsPhone: function() {
                    return /(Windows\sPhone|IEMobile)/i.test(helpers.userAgent)
                },
                isWindowsOS: function() {
                    return /(Windows NT \d\.\d)/i.test(helpers.userAgent)
                },
                isIE: function() {
                    return /(MSIE ([0-9]{1,}[\.0-9]{0,})|Trident\/)/i.test(helpers.userAgent)
                },
                isChrome: function() {
                    return "chrome" in window
                },
                isSafari: delurkWinPhone(function() {
                    var userAgent;
                    userAgent = helpers.userAgent;
                    return /Safari/i.test(userAgent) && !/Chrome/i.test(userAgent)
                }),
                isFirefox: delurkWinPhone(function() {
                    return helpers.firefoxVersion() != null
                }),
                isAndroidBrowser: function() {
                    var version;
                    version = helpers.androidWebkitVersion();
                    return version && version < 537
                },
                isAndroidChrome: function() {
                    var version;
                    version = helpers.androidWebkitVersion();
                    return version && version >= 537
                },
                isAndroidDevice: delurkWinPhone(function() {
                    return /Android/.test(helpers.userAgent)
                }),
                isAndroidWebView: function() {
                    return helpers.isAndroidChrome() && /Version\/\d+\.\d+/.test(helpers.userAgent)
                },
                isAndroidFacebookApp: function() {
                    return helpers.isAndroidChrome() && /FBAV\/\d+\.\d+/.test(helpers.userAgent)
                },
                isNativeWebContainer: function() {
                    return window.cordova != null || /GSA\/\d+\.\d+/.test(helpers.userAgent)
                },
                isSupportedMobileOS: function() {
                    return helpers.isiOS() || helpers.isAndroidDevice()
                },
                isAndroidWebapp: function() {
                    var metaTag;
                    if (!helpers.isAndroidChrome()) {
                        return false
                    }
                    metaTag = document.getElementsByName("apple-mobile-web-app-capable")[0] || document.getElementsByName("mobile-web-app-capable")[0];
                    return metaTag && metaTag.content === "yes"
                },
                isiOSBroken: function() {
                    var chromeVersion;
                    chromeVersion = helpers.iOSChromeVersion();
                    if (helpers.iOSVersion() === 9 && helpers.iOSMinorVersion() >= 2 && chromeVersion && chromeVersion <= 47) {
                        return true
                    }
                    if (helpers.isiPad() && helpers.iOSVersion() === 8) {
                        switch (helpers.iOSMinorVersion()) {
                            case 0:
                                return true;
                            case 1:
                                return helpers.iOSBuildVersion() < 1
                        }
                    }
                    return false
                },
                isUserGesture: function() {
                    var _ref, _ref1;
                    return (_ref = (_ref1 = window.event) != null ? _ref1.type : void 0) === "click" || _ref === "touchstart" || _ref === "touchend"
                },
                isInsideFrame: function() {
                    return window.top !== window.self
                },
                isFallback: function() {
                    var androidVersion, criosVersion, ffVersion, iOSVersion;
                    if (!("postMessage" in window) || window.postMessageDisabled || document.documentMode && document.documentMode < 8) {
                        return true
                    }
                    androidVersion = helpers.androidVersion();
                    if (androidVersion && androidVersion < 4) {
                        return true
                    }
                    iOSVersion = helpers.iOSVersion();
                    if (iOSVersion && iOSVersion < 6) {
                        return true
                    }
                    ffVersion = helpers.firefoxVersion();
                    if (ffVersion && ffVersion < 11) {
                        return true
                    }
                    criosVersion = helpers.iOSChromeVersion();
                    if (criosVersion && criosVersion < 36) {
                        return true
                    }
                    return false
                },
                isSmallScreen: function() {
                    return Math.min(window.screen.availHeight, window.screen.availWidth) <= 640 || /FakeCheckoutMobile/.test(helpers.userAgent)
                },
                pad: function(number, width, padding) {
                    var leading;
                    if (width == null) {
                        width = 2
                    }
                    if (padding == null) {
                        padding = "0"
                    }
                    number = number + "";
                    if (number.length > width) {
                        return number
                    }
                    leading = new Array(width - number.length + 1).join(padding);
                    return leading + number
                },
                requestAnimationFrame: function(callback) {
                    return (typeof window.requestAnimationFrame === "function" ? window.requestAnimationFrame(callback) : void 0) || (typeof window.webkitRequestAnimationFrame === "function" ? window.webkitRequestAnimationFrame(callback) : void 0) || window.setTimeout(callback, 100)
                },
                requestAnimationInterval: function(func, interval) {
                    var callback, previous;
                    previous = new Date;
                    callback = function() {
                        var frame, now, remaining;
                        frame = helpers.requestAnimationFrame(callback);
                        now = new Date;
                        remaining = interval - (now - previous);
                        if (remaining <= 0) {
                            previous = now;
                            func()
                        }
                        return frame
                    };
                    return callback()
                },
                getQueryParameterByName: function(name) {
                    var match;
                    match = RegExp("[?&]" + name + "=([^&]*)").exec(window.location.search);
                    return match && decodeURIComponent(match[1].replace(/\+/g, " "))
                },
                addQueryParameter: function(url, name, value) {
                    var hashParts, query;
                    query = encodeURIComponent(name) + "=" + encodeURIComponent(value);
                    hashParts = new String(url).split("#");
                    hashParts[0] += hashParts[0].indexOf("?") !== -1 ? "&" : "?";
                    hashParts[0] += query;
                    return hashParts.join("#")
                },
                bind: function(element, name, callback) {
                    if (element.addEventListener) {
                        return element.addEventListener(name, callback, false)
                    } else {
                        return element.attachEvent("on" + name, callback)
                    }
                },
                unbind: function(element, name, callback) {
                    if (element.removeEventListener) {
                        return element.removeEventListener(name, callback, false)
                    } else {
                        return element.detachEvent("on" + name, callback)
                    }
                },
                host: function(url) {
                    var parent, parser;
                    parent = document.createElement("div");
                    parent.innerHTML = '<a href="' + this.escape(url) + '">x</a>';
                    parser = parent.firstChild;
                    return "" + parser.protocol + "//" + parser.host
                },
                strip: function(html) {
                    var tmp, _ref, _ref1;
                    tmp = document.createElement("div");
                    tmp.innerHTML = html;
                    return (_ref = (_ref1 = tmp.textContent) != null ? _ref1 : tmp.innerText) != null ? _ref : ""
                },
                replaceFullWidthNumbers: function(el) {
                    var char, fullWidth, halfWidth, idx, original, replaced, _i, _len, _ref;
                    fullWidth = "０１２３４５６７８９";
                    halfWidth = "0123456789";
                    original = el.value;
                    replaced = "";
                    _ref = original.split("");
                    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
                        char = _ref[_i];
                        idx = fullWidth.indexOf(char);
                        if (idx > -1) {
                            char = halfWidth[idx]
                        }
                        replaced += char
                    }
                    if (original !== replaced) {
                        return el.value = replaced
                    }
                },
                setAutocomplete: function(el, type) {
                    var secureCCFill;
                    secureCCFill = helpers.chromeVersion() > 14 || helpers.safariVersion() > 7;
                    if (type !== "cc-csc" && (!/^cc-/.test(type) || secureCCFill)) {
                        el.setAttribute("x-autocompletetype", type);
                        el.setAttribute("autocompletetype", type)
                    } else {
                        el.setAttribute("autocomplete", "off")
                    }
                    if (!(type === "country-name" || type === "language" || type === "sex" || type === "gender-identity")) {
                        el.setAttribute("autocorrect", "off");
                        el.setAttribute("spellcheck", "off")
                    }
                    if (!(/name|honorific/.test(type) || (type === "locality" || type === "city" || type === "adminstrative-area" || type === "state" || type === "province" || type === "region" || type === "language" || type === "org" || type === "organization-title" || type === "sex" || type === "gender-identity"))) {
                        return el.setAttribute("autocapitalize", "off")
                    }
                },
                hashCode: function(str) {
                    var hash, i, _i, _ref;
                    hash = 5381;
                    for (i = _i = 0, _ref = str.length; _i < _ref; i = _i += 1) {
                        hash = (hash << 5) + hash + str.charCodeAt(i)
                    }
                    return (hash >>> 0) % 65535
                },
                stripeUrlPrefix: function() {
                    var match;
                    match = window.location.hostname.match("^([a-z-]*)checkout.");
                    if (match) {
                        return match[1]
                    } else {
                        return ""
                    }
                },
                clientLocale: function() {
                    return (window.navigator.languages || [])[0] || window.navigator.userLanguage || window.navigator.language
                },
                dashToCamelCase: function(dashed) {
                    return dashed.replace(/-(\w)/g, function(match, char) {
                        return char.toUpperCase()
                    })
                },
                camelToDashCase: function(cameled) {
                    return cameled.replace(/([A-Z])/g, function(g) {
                        return "-" + g.toLowerCase()
                    })
                },
                isArray: Array.isArray || function(val) {
                    return {}.toString.call(val) === "[object Array]"
                }
            };
            module.exports = helpers
        }).call(this)
    }
});
StripeCheckout.require.define({
    "lib/spellChecker": function(exports, require, module) {
        (function() {
            var levenshtein;
            module.exports = {
                levenshtein: levenshtein = function(str1, str2) {
                    var d, i, j, m, n, _i, _j, _k, _l;
                    m = str1.length;
                    n = str2.length;
                    d = [];
                    if (!m) {
                        return n
                    }
                    if (!n) {
                        return m
                    }
                    for (i = _i = 0; 0 <= m ? _i <= m : _i >= m; i = 0 <= m ? ++_i : --_i) {
                        d[i] = [i]
                    }
                    for (j = _j = 1; 1 <= n ? _j <= n : _j >= n; j = 1 <= n ? ++_j : --_j) {
                        d[0][j] = j
                    }
                    for (i = _k = 1; 1 <= m ? _k <= m : _k >= m; i = 1 <= m ? ++_k : --_k) {
                        for (j = _l = 1; 1 <= n ? _l <= n : _l >= n; j = 1 <= n ? ++_l : --_l) {
                            if (str1[i - 1] === str2[j - 1]) {
                                d[i][j] = d[i - 1][j - 1]
                            } else {
                                d[i][j] = Math.min(d[i - 1][j], d[i][j - 1], d[i - 1][j - 1]) + 1
                            }
                        }
                    }
                    return d[m][n]
                },
                suggest: function(dictionary, badword, threshold) {
                    var dist, maxDist, suggestion, word, _i, _len;
                    if (threshold == null) {
                        threshold = Infinity
                    }
                    maxDist = Infinity;
                    suggestion = null;
                    for (_i = 0, _len = dictionary.length; _i < _len; _i++) {
                        word = dictionary[_i];
                        dist = levenshtein(word, badword);
                        if (dist < maxDist) {
                            maxDist = dist;
                            suggestion = word
                        }
                    }
                    if (maxDist < threshold) {
                        return suggestion
                    } else {
                        return null
                    }
                }
            }
        }).call(this)
    }
});
StripeCheckout.require.define({
    "lib/optionHelpers": function(exports, require, module) {
        (function() {
            var dumpObject, flatten, helpers, identity, prettyPrint, repr, toBoolean, toNumber, toString, truncate;
            helpers = require("lib/helpers");
            flatten = function(obj) {
                var flattened, key, val, _ref;
                flattened = {};
                for (key in obj) {
                    val = obj[key];
                    if ((_ref = typeof val) === "function" || _ref === "object") {
                        flattened[key] = "" + val
                    } else {
                        flattened[key] = val
                    }
                }
                return JSON.stringify(flattened)
            };
            repr = function(val) {
                switch (typeof val) {
                    case "function":
                        return '"' + val + '"';
                    case "object":
                        return flatten(val);
                    default:
                        return "" + JSON.stringify(val)
                }
            };
            truncate = function(val, cap) {
                if (val.length - 3 > cap) {
                    return val.slice(0, cap - 3) + "..."
                } else {
                    return val
                }
            };
            dumpObject = function(obj) {
                return truncate(repr(obj), 50)
            };
            prettyPrint = function(key, rawOptions) {
                var original, _ref;
                original = (_ref = rawOptions.__originals) != null ? _ref[key] : void 0;
                if (original) {
                    return original
                } else if (rawOptions.buttonIntegration) {
                    return "data-" + helpers.camelToDashCase(key)
                } else {
                    return key
                }
            };
            toBoolean = function(val) {
                return val !== "false" && val !== false && val != null
            };
            toNumber = function(val) {
                if (typeof val === "number") {
                    return val
                } else if (typeof val === "string") {
                    return parseInt(val)
                }
            };
            toString = function(val) {
                if (val == null) {
                    return ""
                } else {
                    return "" + val
                }
            };
            identity = function(val) {
                return val
            };
            module.exports = {
                prettyPrint: prettyPrint,
                flatten: flatten,
                repr: repr,
                truncate: truncate,
                dumpObject: dumpObject,
                toBoolean: toBoolean,
                toNumber: toNumber,
                toString: toString,
                identity: identity
            }
        }).call(this)
    }
});
StripeCheckout.require.define({
    "lib/paymentMethods": function(exports, require, module) {
        (function() {
            var ERROR, METHODS, OPTIONAL, PRETTY_METHODS, PRIVATE, REQUIRED, WARNING, alipayEnabled, alipayToCanonical, canonicalize, checkContext, checkNoDuplicates, checkNoOldAPI, coerceDefaults, deepMethodTypeCheck, helpers, isValidMethod, methodName, methodsArrayToDict, optionHelpers, optionValidator, simpleMethodTypeCheck, simpleToCanonical, singleMethodTypeCheck, spec, transformMethods, _exports, _ref, _ref1, __hasProp = {}.hasOwnProperty,
                __indexOf = [].indexOf || function(item) {
                    for (var i = 0, l = this.length; i < l; i++) {
                        if (i in this && this[i] === item) return i
                    }
                    return -1
                };
            helpers = require("lib/helpers");
            optionHelpers = require("lib/optionHelpers");
            optionValidator = require("lib/optionValidator");
            _ref = optionValidator.severities, ERROR = _ref.ERROR, WARNING = _ref.WARNING;
            _ref1 = optionValidator.importances, OPTIONAL = _ref1.OPTIONAL, REQUIRED = _ref1.REQUIRED, PRIVATE = _ref1.PRIVATE;
            alipayEnabled = function(key, val, options) {
                var prettyAlipay, type;
                type = typeof val;
                if (type !== "boolean" && val !== "auto") {
                    prettyAlipay = optionHelpers.prettyPrint("alipay", options);
                    return {
                        type: WARNING,
                        message: "The '" + prettyAlipay + "' option can be true, false, or 'auto', but instead we found " + optionHelpers.dumpObject(val) + "."
                    }
                } else {
                    return null
                }
            };
            METHODS = {
                alipay: {
                    method: {
                        importance: REQUIRED,
                        spec: optionValidator.ignore,
                        checkContext: optionValidator.ignore
                    },
                    enabled: {
                        importance: REQUIRED,
                        spec: alipayEnabled,
                        checkContext: optionValidator.ignore,
                        "default": false
                    },
                    reusable: {
                        importance: OPTIONAL,
                        spec: optionValidator.isNullableBoolean,
                        checkContext: optionValidator.ignore,
                        "default": false
                    }
                },
                card: {
                    method: {
                        importance: REQUIRED,
                        spec: optionValidator.ignore,
                        checkContext: optionValidator.ignore
                    },
                    enabled: {
                        importance: OPTIONAL,
                        spec: optionValidator.isBoolean,
                        checkContext: optionValidator.ignore,
                        "default": true
                    }
                },
                bitcoin: {
                    method: {
                        importance: REQUIRED,
                        spec: optionValidator.ignore,
                        checkContext: optionValidator.ignore
                    },
                    enabled: {
                        importance: OPTIONAL,
                        spec: optionValidator.isBoolean,
                        checkContext: optionValidator.ignore,
                        "default": false
                    }
                }
            };
            isValidMethod = function(method) {
                return method in METHODS
            };
            PRETTY_METHODS = function() {
                var method, methods, n;
                methods = function() {
                    var _results;
                    _results = [];
                    for (method in METHODS) {
                        _results.push("'" + method + "'")
                    }
                    return _results
                }();
                n = methods.length;
                methods[n - 1] = "or " + methods[n - 1];
                return methods.join(", ")
            }();
            simpleMethodTypeCheck = function(method) {
                var prettyMethod;
                if (!isValidMethod(method)) {
                    prettyMethod = optionHelpers.dumpObject(methodSettings.method);
                    return {
                        type: ERROR,
                        message: "'" + method + "' is not a valid payment method. It must be one of " + PRETTY_METHODS
                    }
                } else {
                    return null
                }
            };
            deepMethodTypeCheck = function(methodSettings) {
                var error, errors, optionSpec, warnings, _ref2;
                error = simpleMethodTypeCheck(methodSettings.method);
                if (error != null) {
                    return error
                }
                optionSpec = METHODS[methodSettings.method];
                _ref2 = optionValidator.validate(optionSpec, methodSettings), errors = _ref2.errors, warnings = _ref2.warnings;
                errors = errors.concat(warnings);
                if (errors.length > 0) {
                    return {
                        type: ERROR,
                        message: "Error when checking the '" + methodSettings.method + "' method:\n" + errors[0].toString()
                    }
                } else {
                    return null
                }
            };
            singleMethodTypeCheck = function(method, idx) {
                var methodSettings, pretty;
                if (typeof method === "string") {
                    return simpleMethodTypeCheck(method)
                } else if ((method != null ? method.method : void 0) != null) {
                    methodSettings = method;
                    return deepMethodTypeCheck(methodSettings)
                } else {
                    pretty = optionHelpers.dumpObject(methodSettings);
                    return {
                        type: ERROR,
                        message: "All elements of paymentMethods need to be either an object with a 'method' property or one of these strings: " + PRETTY_METHODS + ".\n At index " + idx + " we found '" + pretty + "' which was neither."
                    }
                }
            };
            spec = function(key, val, options) {
                var actualType, error, idx, method, _i, _len;
                if (val === null) {
                    return null
                }
                if (!helpers.isArray(val)) {
                    actualType = val === null ? "null" : typeof val;
                    return {
                        type: ERROR,
                        message: "Looking for an Array, but instead we found '" + actualType + "'."
                    }
                }
                for (idx = _i = 0, _len = val.length; _i < _len; idx = ++_i) {
                    method = val[idx];
                    error = singleMethodTypeCheck(method, idx);
                    if (error != null) {
                        return error
                    }
                }
                return null
            };
            checkNoDuplicates = function(val) {
                var idx, method, sortedMethods, usedMethods, _i, _len, _ref2;
                usedMethods = function() {
                    var _i, _len, _results;
                    _results = [];
                    for (_i = 0, _len = val.length; _i < _len; _i++) {
                        method = val[_i];
                        if (typeof method === "string") {
                            _results.push(method)
                        } else if ((method != null ? method.method : void 0) != null) {
                            _results.push(method.method)
                        } else {
                            _results.push(null)
                        }
                    }
                    return _results
                }();
                sortedMethods = usedMethods.concat().sort();
                _ref2 = sortedMethods.slice(1);
                for (idx = _i = 0, _len = _ref2.length; _i < _len; idx = ++_i) {
                    method = _ref2[idx];
                    if (method === sortedMethods[idx]) {
                        return {
                            type: ERROR,
                            message: "You've configured the payment method '" + method + "' multiple times."
                        }
                    }
                }
                return null
            };
            checkNoOldAPI = function(options) {
                var alipay, alipayReusable, bitcoin, paymentMethods;
                if (options.alipay != null || options.bitcoin != null || options.alipayReusable != null) {
                    alipay = optionHelpers.prettyPrint("alipay", options);
                    alipayReusable = optionHelpers.prettyPrint("alipayReusable", options);
                    bitcoin = optionHelpers.prettyPrint("bitcoin", options);
                    paymentMethods = optionHelpers.prettyPrint("paymentMethods", options);
                    return {
                        type: ERROR,
                        message: "Setting any of the the '" + alipay + "', '" + alipayReusable + "', or '" + bitcoin + "' options is disallowed if you are using '" + paymentMethods + "'."
                    }
                } else {
                    return null
                }
            };
            checkContext = function(key, val, options) {
                var error;
                error = checkNoOldAPI(options);
                if (error != null) {
                    return error
                }
                if (val == null) {
                    return
                }
                return checkNoDuplicates(val)
            };
            coerceDefaults = function(methodSpec, methodSettings) {
                var setting, _results;
                _results = [];
                for (setting in methodSpec) {
                    if (methodSettings[setting] == null) {
                        _results.push(methodSettings[setting] = methodSpec[setting]["default"])
                    } else {
                        _results.push(void 0)
                    }
                }
                return _results
            };
            simpleToCanonical = function(method, enabled) {
                var methodSettings;
                methodSettings = {
                    method: method,
                    enabled: enabled
                };
                coerceDefaults(METHODS[method], methodSettings);
                return methodSettings
            };
            alipayToCanonical = function(enabled, reusable) {
                var methodSettings;
                methodSettings = {
                    method: "alipay",
                    enabled: enabled,
                    reusable: reusable
                };
                coerceDefaults(METHODS.alipay, methodSettings);
                return methodSettings
            };
            transformMethods = function(paymentMethods) {
                var has, hasMethod, method, methodSettings, result, _i, _len;
                result = [];
                has = {};
                for (method in METHODS) {
                    has[method] = false
                }
                for (_i = 0, _len = paymentMethods.length; _i < _len; _i++) {
                    method = paymentMethods[_i];
                    if (typeof method === "string") {
                        result.push(simpleToCanonical(method, true));
                        has[method] = true
                    } else {
                        methodSettings = method;
                        if (methodSettings["enabled"] == null) {
                            methodSettings["enabled"] = true
                        }
                        coerceDefaults(METHODS[methodSettings.method], methodSettings);
                        has[methodSettings.method] = true;
                        result.push(methodSettings)
                    }
                }
                for (method in has) {
                    hasMethod = has[method];
                    if (!hasMethod) {
                        result.push(simpleToCanonical(method, false))
                    }
                }
                return result
            };
            methodsArrayToDict = function(paymentMethods) {
                var enabled, methodSettings, settings, _i, _len;
                settings = {};
                enabled = [];
                for (_i = 0, _len = paymentMethods.length; _i < _len; _i++) {
                    methodSettings = paymentMethods[_i];
                    settings[methodSettings.method] = methodSettings;
                    if (methodSettings.enabled !== false) {
                        enabled.push(methodSettings.method)
                    }
                }
                return {
                    settings: settings,
                    enabled: enabled
                }
            };
            canonicalize = function(rawOptions) {
                var blacklist, hasAlipay, option, result, val;
                result = {};
                blacklist = ["bitcoin", "alipay", "alipayReusable"];
                for (option in rawOptions) {
                    if (!__hasProp.call(rawOptions, option)) continue;
                    val = rawOptions[option];
                    if (__indexOf.call(blacklist, option) < 0) {
                        result[option] = val
                    }
                }
                if (rawOptions.paymentMethods != null) {
                    result.paymentMethods = methodsArrayToDict(transformMethods(rawOptions.paymentMethods))
                } else {
                    hasAlipay = rawOptions.alipay || rawOptions.alipayReusable || false;
                    result.paymentMethods = methodsArrayToDict([simpleToCanonical("card", true), simpleToCanonical("bitcoin", rawOptions.bitcoin || false), alipayToCanonical(hasAlipay, rawOptions.alipayReusable)])
                }
                return result
            };
            _exports = {
                alipayEnabled: alipayEnabled,
                spec: spec,
                checkContext: checkContext,
                canonicalize: canonicalize,
                methods: function() {
                    var _results;
                    _results = [];
                    for (methodName in METHODS) {
                        _results.push(methodName)
                    }
                    return _results
                }()
            };
            for (methodName in METHODS) {
                _exports[methodName] = methodName
            }
            module.exports = _exports
        }).call(this)
    }
});
StripeCheckout.require.define({
    "lib/optionSpecs": function(exports, require, module) {
        (function() {
            var BOOLEAN, BUTTON, BUTTON_CONFIGURE_OPTIONS, BUTTON_OPEN_OPTIONS, CUSTOM, CUSTOM_CONFIGURE_OPTIONS, CUSTOM_OPEN_OPTIONS, ERROR, EVENTUALLY_REQUIRED, NULLABLE_BOOLEAN, NULLABLE_NUMBER, NULLABLE_STRING, NULLABLE_URL, NUMBER, OPTIONAL, OPTIONS, OTHER, PRIVATE, REQUIRED, STRING, URL, WARNING, generateOptions, helpers, option, optionHelpers, optionValidator, optsettings, paymentMethods, _ref, _ref1;
            helpers = require("lib/helpers");
            optionHelpers = require("lib/optionHelpers");
            paymentMethods = require("lib/paymentMethods");
            optionValidator = require("lib/optionValidator");
            _ref = optionValidator.severities, ERROR = _ref.ERROR, WARNING = _ref.WARNING;
            _ref1 = optionValidator.importances, OPTIONAL = _ref1.OPTIONAL, REQUIRED = _ref1.REQUIRED, EVENTUALLY_REQUIRED = _ref1.EVENTUALLY_REQUIRED, PRIVATE = _ref1.PRIVATE;
            BUTTON = "button";
            CUSTOM = "custom";
            STRING = "string";
            URL = "url";
            BOOLEAN = "boolean";
            NUMBER = "number";
            NULLABLE_STRING = "null-string";
            NULLABLE_URL = "null-url";
            NULLABLE_BOOLEAN = "null-boolean";
            NULLABLE_NUMBER = "null-number";
            OTHER = "other";
            OPTIONS = {
                address: {
                    importance: PRIVATE,
                    type: OTHER,
                    checkContext: function(key, val, options) {
                        var prettyAddress, prettyBilling;
                        prettyAddress = optionHelpers.prettyPrint("address", options);
                        prettyBilling = optionHelpers.prettyPrint("billingAddress", options);
                        return {
                            type: WARNING,
                            message: "'" + prettyAddress + "' is deprecated.  Use '" + prettyBilling + "' instead."
                        }
                    }
                },
                alipay: {
                    importance: OPTIONAL,
                    type: OTHER,
                    coerceTo: function(val) {
                        if (val === "auto") {
                            return val
                        }
                        return optionHelpers.toBoolean(val)
                    },
                    spec: function(key, val, options) {
                        if (val === null) {
                            return null
                        } else {
                            return paymentMethods.alipayEnabled(key, val, options)
                        }
                    }
                },
                alipayReusable: {
                    importance: OPTIONAL,
                    type: NULLABLE_BOOLEAN,
                    checkContext: optionValidator.xRequiresY("alipayReusable", "alipay")
                },
                allowRememberMe: {
                    importance: OPTIONAL,
                    type: NULLABLE_BOOLEAN,
                    "default": true
                },
                amount: {
                    importance: OPTIONAL,
                    type: NULLABLE_NUMBER
                },
                billingAddress: {
                    importance: OPTIONAL,
                    type: NULLABLE_BOOLEAN
                },
                bitcoin: {
                    importance: OPTIONAL,
                    type: NULLABLE_BOOLEAN
                },
                buttonIntegration: {
                    importance: PRIVATE,
                    type: BOOLEAN,
                    "default": false
                },
                closed: {
                    only: CUSTOM,
                    importance: OPTIONAL,
                    type: OTHER
                },
                color: {
                    importance: PRIVATE,
                    type: STRING
                },
                currency: {
                    importance: OPTIONAL,
                    type: NULLABLE_STRING,
                    "default": "usd"
                },
                description: {
                    importance: OPTIONAL,
                    type: NULLABLE_STRING
                },
                email: {
                    importance: OPTIONAL,
                    type: NULLABLE_STRING
                },
                image: {
                    importance: OPTIONAL,
                    type: NULLABLE_URL
                },
                key: {
                    importance: REQUIRED,
                    type: STRING
                },
                label: {
                    only: BUTTON,
                    importance: OPTIONAL,
                    type: NULLABLE_STRING
                },
                locale: {
                    importance: OPTIONAL,
                    type: NULLABLE_STRING
                },
                name: {
                    importance: OPTIONAL,
                    type: NULLABLE_STRING
                },
                nostyle: {
                    importance: PRIVATE,
                    type: BOOLEAN
                },
                notrack: {
                    importance: PRIVATE,
                    type: BOOLEAN
                },
                opened: {
                    only: CUSTOM,
                    importance: OPTIONAL,
                    type: OTHER
                },
                panelLabel: {
                    importance: OPTIONAL,
                    type: NULLABLE_STRING
                },
                paymentMethods: {
                    only: CUSTOM,
                    importance: OPTIONAL,
                    type: OTHER,
                    spec: paymentMethods.spec,
                    checkContext: paymentMethods.checkContext
                },
                referrer: {
                    importance: PRIVATE,
                    type: URL
                },
                shippingAddress: {
                    importance: OPTIONAL,
                    type: NULLABLE_BOOLEAN,
                    checkContext: optionValidator.xRequiresY("shippingAddress", "billingAddress")
                },
                supportsTokenCallback: {
                    importance: PRIVATE,
                    type: BOOLEAN
                },
                timeLoaded: {
                    importance: PRIVATE,
                    type: OTHER
                },
                token: {
                    importance: EVENTUALLY_REQUIRED,
                    type: OTHER
                },
                trace: {
                    importance: PRIVATE,
                    type: BOOLEAN
                },
                url: {
                    importance: PRIVATE,
                    type: URL
                },
                zipCode: {
                    importance: OPTIONAL,
                    type: NULLABLE_BOOLEAN
                },
                __originals: {
                    importance: PRIVATE,
                    type: OTHER
                }
            };
            for (option in OPTIONS) {
                optsettings = OPTIONS[option];
                if (optsettings.coerceTo == null) {
                    optsettings.coerceTo = function() {
                        switch (optsettings.type) {
                            case STRING:
                            case NULLABLE_STRING:
                                return optionHelpers.toString;
                            case BOOLEAN:
                            case NULLABLE_BOOLEAN:
                                return optionHelpers.toBoolean;
                            case NUMBER:
                            case NULLABLE_NUMBER:
                                return optionHelpers.toNumber;
                            case URL:
                            case NULLABLE_URL:
                                return helpers.sanitizeURL;
                            case OTHER:
                                return optionHelpers.identity
                        }
                    }()
                }
                if (optsettings.spec == null) {
                    optsettings.spec = function() {
                        switch (optsettings.type) {
                            case STRING:
                            case URL:
                                return optionValidator.isString;
                            case BOOLEAN:
                                return optionValidator.isBoolean;
                            case NUMBER:
                                return optionValidator.isNumber;
                            case NULLABLE_STRING:
                            case NULLABLE_URL:
                                return optionValidator.isNullableString;
                            case NULLABLE_BOOLEAN:
                                return optionValidator.isNullableBoolean;
                            case NULLABLE_NUMBER:
                                return optionValidator.isNullableNumber;
                            case OTHER:
                                return optionValidator.ignore
                        }
                    }()
                }
                if (optsettings.checkContext == null) {
                    optsettings.checkContext = optionValidator.ignore
                }
            }
            generateOptions = function(_arg) {
                var isConfigure, only, result, setting, val, _optsettings;
                only = _arg.only, isConfigure = _arg.isConfigure;
                result = {};
                for (option in OPTIONS) {
                    _optsettings = OPTIONS[option];
                    if (_optsettings.only != null && _optsettings.only !== only) {
                        continue
                    }
                    optsettings = {};
                    for (setting in _optsettings) {
                        val = _optsettings[setting];
                        if (setting === "importance" && val === EVENTUALLY_REQUIRED) {
                            if (isConfigure) {
                                optsettings[setting] = OPTIONAL
                            } else {
                                optsettings[setting] = REQUIRED
                            }
                        } else {
                            optsettings[setting] = val
                        }
                    }
                    result[option] = optsettings
                }
                return result
            };
            BUTTON_CONFIGURE_OPTIONS = generateOptions({
                only: BUTTON,
                isConfigure: true
            });
            BUTTON_OPEN_OPTIONS = generateOptions({
                only: BUTTON,
                isConfigure: false
            });
            CUSTOM_CONFIGURE_OPTIONS = generateOptions({
                only: CUSTOM,
                isConfigure: true
            });
            CUSTOM_OPEN_OPTIONS = generateOptions({
                only: CUSTOM,
                isConfigure: false
            });
            module.exports = {
                _OPTIONS: OPTIONS,
                types: {
                    STRING: STRING,
                    BOOLEAN: BOOLEAN,
                    NUMBER: NUMBER,
                    NULLABLE_STRING: NULLABLE_STRING,
                    NULLABLE_URL: NULLABLE_URL,
                    NULLABLE_BOOLEAN: NULLABLE_BOOLEAN,
                    NULLABLE_NUMBER: NULLABLE_NUMBER,
                    URL: URL,
                    OTHER: OTHER
                },
                buttonConfigureOptions: BUTTON_CONFIGURE_OPTIONS,
                buttonOpenOptions: BUTTON_OPEN_OPTIONS,
                customConfigureOptions: CUSTOM_CONFIGURE_OPTIONS,
                customOpenOptions: CUSTOM_OPEN_OPTIONS,
                all: [BUTTON_CONFIGURE_OPTIONS, BUTTON_OPEN_OPTIONS, CUSTOM_CONFIGURE_OPTIONS, CUSTOM_OPEN_OPTIONS]
            }
        }).call(this)
    }
});
StripeCheckout.require.define({
    "lib/optionValidator": function(exports, require, module) {
        (function() {
            var ERROR, EVENTUALLY_REQUIRED, ErrorMissingRequired, ErrorMisspelledRequired, OPTIONAL, PRIVATE, REQUIRED, WARNING, WarnBadContext, WarnMisspelledOptional, WarnOptionTypeError, WarnUnrecognized, checkOptionContexts, checkOptionTypes, checkRequiredOptions, checkUnrecognizedOptions, coerceOption, fromSpec, ignore, isBoolean, isNullableBoolean, isNullableNumber, isNullableString, isNumber, isRequired, isString, optionHelpers, simpleNullableTypeCheck, simpleTypeCheck, spellChecker, validate, xRequiresY, __indexOf = [].indexOf || function(item) {
                for (var i = 0, l = this.length; i < l; i++) {
                    if (i in this && this[i] === item) return i
                }
                return -1
            };
            spellChecker = require("lib/spellChecker");
            optionHelpers = require("lib/optionHelpers");
            ERROR = "error";
            WARNING = "warning";
            OPTIONAL = "optional";
            REQUIRED = "required";
            EVENTUALLY_REQUIRED = "eventually-required";
            PRIVATE = "private";
            isRequired = function(importance) {
                return importance === REQUIRED || importance === EVENTUALLY_REQUIRED
            };
            fromSpec = function(optionSpec) {
                var opt, val;
                return {
                    all: optionSpec,
                    required: function() {
                        var _results;
                        _results = [];
                        for (opt in optionSpec) {
                            val = optionSpec[opt];
                            if (isRequired(val.importance)) {
                                _results.push(opt)
                            }
                        }
                        return _results
                    }(),
                    suggestable: function() {
                        var _results;
                        _results = [];
                        for (opt in optionSpec) {
                            val = optionSpec[opt];
                            if (val.importance !== PRIVATE) {
                                _results.push(opt)
                            }
                        }
                        return _results
                    }()
                }
            };
            simpleTypeCheck = function(expectedType, val) {
                var actualType;
                actualType = typeof val;
                if (actualType !== expectedType) {
                    if (val === null) {
                        actualType = "null"
                    }
                    return {
                        type: WARNING,
                        message: "Looking for type '" + expectedType + "', but instead we found '" + actualType + "'."
                    }
                } else {
                    return null
                }
            };
            simpleNullableTypeCheck = function(expectedType, val) {
                if (val === null) {
                    return null
                }
                return simpleTypeCheck(expectedType, val)
            };
            isString = function(key, val, options) {
                return simpleTypeCheck("string", val)
            };
            isBoolean = function(key, val, options) {
                return simpleTypeCheck("boolean", val)
            };
            isNumber = function(key, val, options) {
                return simpleTypeCheck("number", val)
            };
            isNullableString = function(key, val, options) {
                return simpleNullableTypeCheck("string", val)
            };
            isNullableBoolean = function(key, val, options) {
                return simpleNullableTypeCheck("boolean", val)
            };
            isNullableNumber = function(key, val, options) {
                return simpleNullableTypeCheck("number", val)
            };
            ignore = function() {
                return null
            };
            xRequiresY = function(requiring, required) {
                return function(key, val, options) {
                    var prettyRequired, prettyRequiring;
                    if (!options[required]) {
                        prettyRequired = optionHelpers.prettyPrint(required, options);
                        prettyRequiring = optionHelpers.prettyPrint(requiring, options);
                        return {
                            type: WARNING,
                            message: "'" + prettyRequired + "' must be enabled whenever '" + prettyRequiring + "' is."
                        }
                    }
                }
            };
            ErrorMissingRequired = function() {
                function ErrorMissingRequired(rawOptions, key) {
                    this.rawOptions = rawOptions;
                    this.key = key
                }
                ErrorMissingRequired.prototype.toString = function() {
                    var key;
                    key = optionHelpers.prettyPrint(this.key, this.rawOptions);
                    return "'" + key + "' is a required option, but was not found."
                };
                ErrorMissingRequired.prototype.trackedInfo = function() {
                    return {
                        result: "ErrorMissingRequired",
                        key: this.key
                    }
                };
                return ErrorMissingRequired
            }();
            ErrorMisspelledRequired = function() {
                function ErrorMisspelledRequired(rawOptions, expected, actual) {
                    this.rawOptions = rawOptions;
                    this.expected = expected;
                    this.actual = actual
                }
                ErrorMisspelledRequired.prototype.toString = function() {
                    var actual, expected;
                    expected = optionHelpers.prettyPrint(this.expected, this.rawOptions);
                    actual = optionHelpers.prettyPrint(this.actual, this.rawOptions);
                    return "Unrecognized option '" + actual + "'. Did you mean '" + expected + "'? ('" + expected + "' is required)"
                };
                ErrorMisspelledRequired.prototype.trackedInfo = function() {
                    return {
                        result: "ErrorMisspelledRequired",
                        expected: this.expected,
                        actual: this.actual
                    }
                };
                return ErrorMisspelledRequired
            }();
            WarnMisspelledOptional = function() {
                function WarnMisspelledOptional(rawOptions, expected, actual) {
                    this.rawOptions = rawOptions;
                    this.expected = expected;
                    this.actual = actual
                }
                WarnMisspelledOptional.prototype.toString = function() {
                    var actual, expected;
                    expected = optionHelpers.prettyPrint(this.expected, this.rawOptions);
                    actual = optionHelpers.prettyPrint(this.actual, this.rawOptions);
                    return "Unrecognized option '" + actual + "'. Did you mean '" + expected + "'?"
                };
                WarnMisspelledOptional.prototype.trackedInfo = function() {
                    return {
                        result: "WarnMisspelledOptional",
                        expected: this.expected,
                        actual: this.actual
                    }
                };
                return WarnMisspelledOptional
            }();
            WarnUnrecognized = function() {
                function WarnUnrecognized(rawOptions, key) {
                    this.rawOptions = rawOptions;
                    this.key = key
                }
                WarnUnrecognized.prototype.toString = function() {
                    var key;
                    key = optionHelpers.prettyPrint(this.key, this.rawOptions);
                    return "Unrecognized option '" + key + "'."
                };
                WarnUnrecognized.prototype.trackedInfo = function() {
                    return {
                        result: "WarnUnrecognized",
                        key: this.key
                    }
                };
                return WarnUnrecognized
            }();
            WarnOptionTypeError = function() {
                function WarnOptionTypeError(rawOptions, key, message) {
                    this.rawOptions = rawOptions;
                    this.key = key;
                    this.message = message
                }
                WarnOptionTypeError.prototype.toString = function() {
                    var key;
                    key = optionHelpers.prettyPrint(this.key, this.rawOptions);
                    return "Type mismatch for option '" + key + "':\n" + this.message
                };
                WarnOptionTypeError.prototype.trackedInfo = function() {
                    return {
                        result: "WarnOptionTypeError",
                        key: this.key,
                        message: this.message
                    }
                };
                return WarnOptionTypeError
            }();
            WarnBadContext = function() {
                function WarnBadContext(rawOptions, key, message) {
                    this.rawOptions = rawOptions;
                    this.key = key;
                    this.message = message
                }
                WarnBadContext.prototype.toString = function() {
                    return this.message
                };
                WarnBadContext.prototype.trackedInfo = function() {
                    return {
                        result: "WarnBadContext",
                        key: this.key,
                        message: this.message
                    }
                };
                return WarnBadContext
            }();
            coerceOption = function(optionSpec, option, val) {
                var OPTIONS;
                OPTIONS = fromSpec(optionSpec);
                if (val != null && OPTIONS.all[option] != null) {
                    return OPTIONS.all[option].coerceTo(val)
                } else {
                    return val
                }
            };
            checkRequiredOptions = function(OPTIONS, _arg, rawOptions) {
                var errors, reqOpt, warnings, _i, _len, _ref;
                errors = _arg.errors, warnings = _arg.warnings;
                _ref = OPTIONS.required;
                for (_i = 0, _len = _ref.length; _i < _len; _i++) {
                    reqOpt = _ref[_i];
                    if (!(reqOpt in rawOptions)) {
                        errors.push(new ErrorMissingRequired(rawOptions, reqOpt))
                    }
                }
            };
            checkUnrecognizedOptions = function(OPTIONS, _arg, rawOptions) {
                var THRESHOLD, err, errors, idx, missingRequiredErrors, option, suggestion, warnings;
                errors = _arg.errors, warnings = _arg.warnings;
                THRESHOLD = 4;
                for (option in rawOptions) {
                    if (!(option in OPTIONS.all)) {
                        suggestion = spellChecker.suggest(OPTIONS.suggestable, option, THRESHOLD);
                        if (__indexOf.call(OPTIONS.required, suggestion) >= 0) {
                            missingRequiredErrors = function() {
                                var _i, _len, _results;
                                _results = [];
                                for (idx = _i = 0, _len = errors.length; _i < _len; idx = ++_i) {
                                    err = errors[idx];
                                    if (err instanceof ErrorMissingRequired && err.key === suggestion) {
                                        _results.push(idx)
                                    }
                                }
                                return _results
                            }();
                            if (missingRequiredErrors.length > 0) {
                                idx = missingRequiredErrors[0];
                                errors[idx] = new ErrorMisspelledRequired(rawOptions, suggestion, option)
                            } else {
                                warnings.push(new WarnUnrecognized(option))
                            }
                        } else if (suggestion != null) {
                            warnings.push(new WarnMisspelledOptional(rawOptions, suggestion, option))
                        } else {
                            warnings.push(new WarnUnrecognized(rawOptions, option))
                        }
                    }
                }
            };
            checkOptionTypes = function(OPTIONS, _arg, rawOptions) {
                var error, errors, filtered, message, option, type, val, warnings;
                errors = _arg.errors, warnings = _arg.warnings;
                filtered = {};
                for (option in rawOptions) {
                    val = rawOptions[option];
                    if (option in OPTIONS.all) {
                        filtered[option] = val
                    }
                }
                for (option in filtered) {
                    val = filtered[option];
                    error = OPTIONS.all[option].spec(option, val, rawOptions);
                    if (!error) {
                        continue
                    }
                    type = error.type, message = error.message;
                    if (type === ERROR) {
                        errors.push(new WarnOptionTypeError(rawOptions, option, message))
                    } else {
                        warnings.push(new WarnOptionTypeError(rawOptions, option, message))
                    }
                }
            };
            checkOptionContexts = function(OPTIONS, _arg, rawOptions) {
                var error, errors, filtered, message, option, type, val, warnings;
                errors = _arg.errors, warnings = _arg.warnings;
                filtered = {};
                for (option in rawOptions) {
                    val = rawOptions[option];
                    if (option in OPTIONS.all) {
                        filtered[option] = val
                    }
                }
                for (option in filtered) {
                    val = filtered[option];
                    error = OPTIONS.all[option].checkContext(option, val, rawOptions);
                    if (!error) {
                        continue
                    }
                    type = error.type, message = error.message;
                    if (type === ERROR) {
                        errors.push(new WarnBadContext(rawOptions, option, message))
                    } else {
                        warnings.push(new WarnBadContext(rawOptions, option, message))
                    }
                }
            };
            validate = function(optionSpec, rawOptions) {
                var OPTIONS, errors, warnings;
                OPTIONS = fromSpec(optionSpec);
                errors = [];
                warnings = [];
                checkRequiredOptions(OPTIONS, {
                    errors: errors,
                    warnings: warnings
                }, rawOptions);
                checkUnrecognizedOptions(OPTIONS, {
                    errors: errors,
                    warnings: warnings
                }, rawOptions);
                checkOptionTypes(OPTIONS, {
                    errors: errors,
                    warnings: warnings
                }, rawOptions);
                checkOptionContexts(OPTIONS, {
                    errors: errors,
                    warnings: warnings
                }, rawOptions);
                return {
                    errors: errors,
                    warnings: warnings
                }
            };
            module.exports = {
                ErrorMissingRequired: ErrorMissingRequired,
                ErrorMisspelledRequired: ErrorMisspelledRequired,
                WarnMisspelledOptional: WarnMisspelledOptional,
                WarnUnrecognized: WarnUnrecognized,
                WarnOptionTypeError: WarnOptionTypeError,
                WarnBadContext: WarnBadContext,
                severities: {
                    ERROR: ERROR,
                    WARNING: WARNING
                },
                importances: {
                    OPTIONAL: OPTIONAL,
                    REQUIRED: REQUIRED,
                    EVENTUALLY_REQUIRED: EVENTUALLY_REQUIRED,
                    PRIVATE: PRIVATE
                },
                simpleTypeCheck: simpleTypeCheck,
                simpleNullableTypeCheck: simpleNullableTypeCheck,
                isString: isString,
                isBoolean: isBoolean,
                isNumber: isNumber,
                isNullableString: isNullableString,
                isNullableBoolean: isNullableBoolean,
                isNullableNumber: isNullableNumber,
                ignore: ignore,
                xRequiresY: xRequiresY,
                coerceOption: coerceOption,
                validate: validate
            }
        }).call(this)
    }
});
StripeCheckout.require.define({
    "lib/optionParser": function(exports, require, module) {
        (function() {
            var CHECKOUT_DOCS_URL, extractValue, formatMessage, helpers, isLiveModeFromKey, optionSpecs, optionValidator, trackError, trackSummary, trackWarning, tracker, _trackIndividual;
            tracker = require("lib/tracker");
            helpers = require("lib/helpers");
            optionValidator = require("lib/optionValidator");
            optionSpecs = require("lib/optionSpecs");
            CHECKOUT_DOCS_URL = "https://stripe.com/docs/checkout";
            extractValue = function(rawOptions, key) {
                var dashed, downcased;
                if (rawOptions[key] != null) {
                    return rawOptions[key]
                }
                downcased = key.toLowerCase();
                if (rawOptions[downcased] != null) {
                    return rawOptions[downcased]
                }
                dashed = helpers.camelToDashCase(key);
                if (rawOptions[dashed] != null) {
                    return rawOptions[dashed]
                }
            };
            isLiveModeFromKey = function(key) {
                if (!(typeof key === "string" || key instanceof String)) {
                    return false
                }
                return !/^pk_test_.*$/.test(key)
            };
            formatMessage = function(origin, message) {
                return "StripeCheckout." + origin + ": " + message + "\nYou can learn about the available configuration options in the Checkout docs:\n" + CHECKOUT_DOCS_URL
            };
            _trackIndividual = function(level, origin, rawOptions, error) {
                var k, parameters, v, _ref;
                parameters = {
                    "optchecker-origin": origin
                };
                _ref = error.trackedInfo();
                for (k in _ref) {
                    v = _ref[k];
                    parameters["optchecker-" + k] = v
                }
                switch (level) {
                    case "error":
                        tracker.track.configError(parameters, rawOptions);
                        break;
                    case "warning":
                        tracker.track.configWarning(parameters, rawOptions)
                }
            };
            trackSummary = function(parameters, rawOptions) {
                var k, prefixedParams, v;
                prefixedParams = {};
                for (k in parameters) {
                    v = parameters[k];
                    prefixedParams["optchecker-" + k] = v
                }
                return tracker.track.configSummary(prefixedParams, rawOptions)
            };
            trackError = function(origin, rawOptions, error) {
                return _trackIndividual("error", origin, rawOptions, error)
            };
            trackWarning = function(origin, rawOptions, error) {
                return _trackIndividual("warning", origin, rawOptions, error)
            };
            module.exports = {
                coerceButtonOption: function(option, val) {
                    return optionValidator.coerceOption(optionSpecs.buttonConfigureOptions, option, val)
                },
                parse: function(rawOptions) {
                    var OPTIONS, opt, optsettings, parsed, val;
                    if (rawOptions == null) {
                        rawOptions = {}
                    }
                    parsed = {};
                    if (rawOptions.buttonIntegration) {
                        OPTIONS = optionSpecs.buttonOpenOptions
                    } else {
                        OPTIONS = optionSpecs.customOpenOptions
                    }
                    for (opt in OPTIONS) {
                        optsettings = OPTIONS[opt];
                        val = extractValue(rawOptions, opt);
                        if (val == null && optsettings["default"] != null) {
                            val = optsettings["default"]
                        }
                        parsed[opt] = optionValidator.coerceOption(OPTIONS, opt, val)
                    }
                    if (parsed.shippingAddress) {
                        parsed.billingAddress = true
                    }
                    if (rawOptions.address != null && rawOptions.address !== "false" && rawOptions.address !== false) {
                        parsed.billingAddress = true
                    }
                    if (parsed.billingAddress) {
                        parsed.zipCode = false
                    }
                    return parsed
                },
                checkUsage: function(origin, rawOptions, isDarkMode) {
                    var OPTIONS, error, errors, isConfigure, isLiveMode, numErrors, numWarnings, quiet, warning, warnings, _i, _j, _len, _len1, _ref;
                    if (isDarkMode == null) {
                        isDarkMode = false
                    }
                    isLiveMode = isLiveModeFromKey(rawOptions.key);
                    quiet = isLiveMode || isDarkMode;
                    isConfigure = origin === "configure";
                    if (rawOptions.buttonIntegration) {
                        if (isConfigure) {
                            OPTIONS = optionSpecs.buttonConfigureOptions
                        } else {
                            OPTIONS = optionSpecs.buttonOpenOptions
                        }
                    } else {
                        if (isConfigure) {
                            OPTIONS = optionSpecs.customConfigureOptions
                        } else {
                            OPTIONS = optionSpecs.customOpenOptions
                        }
                    }
                    _ref = optionValidator.validate(OPTIONS, rawOptions), errors = _ref.errors, warnings = _ref.warnings;
                    numErrors = errors.length;
                    numWarnings = warnings.length;
                    trackSummary({
                        origin: origin,
                        numErrors: numErrors,
                        numWarnings: numWarnings
                    }, rawOptions);
                    for (_i = 0, _len = errors.length; _i < _len; _i++) {
                        error = errors[_i];
                        if (!quiet) {
                            if (typeof console !== "undefined" && console !== null) {
                                console.error(formatMessage(origin, error.toString()))
                            }
                        }
                        trackError(origin, rawOptions, error)
                    }
                    quiet || (quiet = numErrors > 0);
                    for (_j = 0, _len1 = warnings.length; _j < _len1; _j++) {
                        warning = warnings[_j];
                        if (!quiet) {
                            if (typeof console !== "undefined" && console !== null) {
                                console.warn(formatMessage(origin, warning.toString()))
                            }
                        }
                        trackWarning(origin, rawOptions, warning)
                    }
                }
            }
        }).call(this)
    }
});
StripeCheckout.require.define({
    "lib/rpc": function(exports, require, module) {
        (function() {
            var RPC, helpers, tracker, __bind = function(fn, me) {
                    return function() {
                        return fn.apply(me, arguments)
                    }
                },
                __slice = [].slice;
            helpers = require("lib/helpers");
            tracker = require("lib/tracker");
            RPC = function() {
                function RPC(target, options) {
                    if (options == null) {
                        options = {}
                    }
                    this.processMessage = __bind(this.processMessage, this);
                    this.sendMessage = __bind(this.sendMessage, this);
                    this.invoke = __bind(this.invoke, this);
                    this.startSession = __bind(this.startSession, this);
                    this.rpcID = 0;
                    this.target = target;
                    this.callbacks = {};
                    this.readyQueue = [];
                    this.readyStatus = false;
                    this.methods = {};
                    helpers.bind(window, "message", function(_this) {
                        return function() {
                            var args;
                            args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
                            return _this.message.apply(_this, args)
                        }
                    }(this))
                }
                RPC.prototype.startSession = function() {
                    this.sendMessage("frameReady");
                    return this.frameReady()
                };
                RPC.prototype.invoke = function() {
                    var args, method;
                    method = arguments[0], args = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
                    tracker.trace.rpcInvoke(method);
                    return this.ready(function(_this) {
                        return function() {
                            return _this.sendMessage(method, args)
                        }
                    }(this))
                };
                RPC.prototype.message = function(e) {
                    var shouldProcess;
                    shouldProcess = false;
                    try {
                        shouldProcess = e.source === this.target
                    } catch (_error) {}
                    if (shouldProcess) {
                        return this.processMessage(e.data)
                    }
                };
                RPC.prototype.ready = function(fn) {
                    if (this.readyStatus) {
                        return fn()
                    } else {
                        return this.readyQueue.push(fn)
                    }
                };
                RPC.prototype.frameCallback = function(id, result) {
                    var _base;
                    if (typeof(_base = this.callbacks)[id] === "function") {
                        _base[id](result)
                    }
                    delete this.callbacks[id];
                    return true
                };
                RPC.prototype.frameReady = function() {
                    var callbacks, cb, _i, _len;
                    this.readyStatus = true;
                    callbacks = this.readyQueue.slice(0);
                    for (_i = 0, _len = callbacks.length; _i < _len; _i++) {
                        cb = callbacks[_i];
                        cb()
                    }
                    return false
                };
                RPC.prototype.isAlive = function() {
                    return true
                };
                RPC.prototype.sendMessage = function(method, args) {
                    var err, id, message, _ref;
                    if (args == null) {
                        args = []
                    }
                    id = ++this.rpcID;
                    if (typeof args[args.length - 1] === "function") {
                        this.callbacks[id] = args.pop()
                    }
                    message = JSON.stringify({
                        method: method,
                        args: args,
                        id: id
                    });
                    if (((_ref = this.target) != null ? _ref.postMessage : void 0) == null) {
                        err = new Error("Unable to communicate with Checkout. Please contact support@stripe.com if the problem persists.");
                        if (this.methods.rpcError != null) {
                            this.methods.rpcError(err)
                        } else {
                            throw err
                        }
                        return
                    }
                    this.target.postMessage(message, "*");
                    return tracker.trace.rpcPostMessage(method, args, id)
                };
                RPC.prototype.processMessage = function(data) {
                    var method, result, _base, _name;
                    try {
                        data = JSON.parse(data)
                    } catch (_error) {
                        return
                    }
                    if (["frameReady", "frameCallback", "isAlive"].indexOf(data.method) !== -1) {
                        result = null;
                        method = this[data.method];
                        if (method != null) {
                            result = method.apply(this, data.args)
                        }
                    } else {
                        result = typeof(_base = this.methods)[_name = data.method] === "function" ? _base[_name].apply(_base, data.args) : void 0
                    }
                    if (data.method !== "frameCallback") {
                        return this.invoke("frameCallback", data.id, result)
                    }
                };
                return RPC
            }();
            module.exports = RPC
        }).call(this)
    }
});
StripeCheckout.require.define({
    "lib/uuid": function(exports, require, module) {
        (function() {
            var S4;
            S4 = function() {
                return ((1 + Math.random()) * 65536 | 0).toString(16).substring(1)
            };
            module.exports.generate = function() {
                var delim;
                delim = "-";
                return S4() + S4() + delim + S4() + delim + S4() + delim + S4() + delim + S4() + S4() + S4()
            }
        }).call(this)
    }
});
StripeCheckout.require.define({
    "lib/pixel": function(exports, require, module) {
        (function() {
            var canTrack, encode, generateID, getCookie, getCookieID, getLocalStorageID, request, setCookie, track;
            generateID = function() {
                return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
                    var r, v;
                    r = Math.random() * 16 | 0;
                    v = c === "x" ? r : r & 3 | 8;
                    return v.toString(16)
                })
            };
            setCookie = function(name, value, options) {
                var cookie, expires;
                if (options == null) {
                    options = {}
                }
                if (options.expires === true) {
                    options.expires = -1
                }
                if (typeof options.expires === "number") {
                    expires = new Date;
                    expires.setTime(expires.getTime() + options.expires * 24 * 60 * 60 * 1e3);
                    options.expires = expires
                }
                if (options.path == null) {
                    options.path = "/"
                }
                value = (value + "").replace(/[^!#-+\--:<-\[\]-~]/g, encodeURIComponent);
                cookie = encodeURIComponent(name) + "=" + value;
                if (options.expires) {
                    cookie += ";expires=" + options.expires.toGMTString()
                }
                if (options.path) {
                    cookie += ";path=" + options.path
                }
                if (options.domain) {
                    cookie += ";domain=" + options.domain
                }
                return document.cookie = cookie
            };
            getCookie = function(name) {
                var cookie, cookies, index, key, value, _i, _len;
                cookies = document.cookie.split("; ");
                for (_i = 0, _len = cookies.length; _i < _len; _i++) {
                    cookie = cookies[_i];
                    index = cookie.indexOf("=");
                    key = decodeURIComponent(cookie.substr(0, index));
                    value = decodeURIComponent(cookie.substr(index + 1));
                    if (key === name) {
                        return value
                    }
                }
                return null
            };
            encode = function(param) {
                if (typeof param === "string") {
                    return encodeURIComponent(param)
                } else {
                    return encodeURIComponent(JSON.stringify(param))
                }
            };
            request = function(url, params, callback) {
                var image, k, v;
                if (params == null) {
                    params = {}
                }
                params.i = (new Date).getTime();
                params = function() {
                    var _results;
                    _results = [];
                    for (k in params) {
                        v = params[k];
                        _results.push("" + k + "=" + encode(v))
                    }
                    return _results
                }().join("&");
                image = new Image;
                if (callback) {
                    image.onload = callback
                }
                image.src = "" + url + "?" + params;
                return true
            };
            canTrack = function() {
                var dnt, _ref;
                dnt = (_ref = window.navigator.doNotTrack) != null ? _ref.toString().toLowerCase() : void 0;
                switch (dnt) {
                    case "1":
                    case "yes":
                    case "true":
                        return false;
                    default:
                        return true
                }
            };
            getLocalStorageID = function() {
                var err, lsid;
                if (!canTrack()) {
                    return "DNT"
                }
                try {
                    lsid = localStorage.getItem("lsid");
                    if (!lsid) {
                        lsid = generateID();
                        localStorage.setItem("lsid", lsid)
                    }
                    return lsid
                } catch (_error) {
                    err = _error;
                    return "NA"
                }
            };
            getCookieID = function() {
                var err, id;
                if (!canTrack()) {
                    return "DNT"
                }
                try {
                    id = getCookie("cid") || generateID();
                    setCookie("cid", id, {
                        expires: 360 * 20,
                        domain: ".stripe.com"
                    });
                    return id
                } catch (_error) {
                    err = _error;
                    return "NA"
                }
            };
            track = function(event, params, callback) {
                var k, referrer, request_params, search, v;
                if (params == null) {
                    params = {}
                }
                referrer = document.referrer;
                search = window.location.search;
                request_params = {
                    event: event,
                    rf: referrer,
                    sc: search
                };
                for (k in params) {
                    v = params[k];
                    request_params[k] = v
                }
                request_params.lsid || (request_params.lsid = getLocalStorageID());
                request_params.cid || (request_params.cid = getCookieID());
                return request("https://q.stripe.com", request_params, callback)
            };
            module.exports.track = track;
            module.exports.getLocalStorageID = getLocalStorageID;
            module.exports.getCookieID = getCookieID
        }).call(this)
    }
});
StripeCheckout.require.define({
    "vendor/base64": function(exports, require, module) {
        var utf8Encode = function(string) {
            string = (string + "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
            var utftext = "",
                start, end;
            var stringl = 0,
                n;
            start = end = 0;
            stringl = string.length;
            for (n = 0; n < stringl; n++) {
                var c1 = string.charCodeAt(n);
                var enc = null;
                if (c1 < 128) {
                    end++
                } else if (c1 > 127 && c1 < 2048) {
                    enc = String.fromCharCode(c1 >> 6 | 192, c1 & 63 | 128)
                } else {
                    enc = String.fromCharCode(c1 >> 12 | 224, c1 >> 6 & 63 | 128, c1 & 63 | 128)
                }
                if (enc !== null) {
                    if (end > start) {
                        utftext += string.substring(start, end)
                    }
                    utftext += enc;
                    start = end = n + 1
                }
            }
            if (end > start) {
                utftext += string.substring(start, string.length)
            }
            return utftext
        };
        module.exports.encode = function(data) {
            var b64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
            var o1, o2, o3, h1, h2, h3, h4, bits, i = 0,
                ac = 0,
                enc = "",
                tmp_arr = [];
            if (!data) {
                return data
            }
            data = utf8Encode(data);
            do {
                o1 = data.charCodeAt(i++);
                o2 = data.charCodeAt(i++);
                o3 = data.charCodeAt(i++);
                bits = o1 << 16 | o2 << 8 | o3;
                h1 = bits >> 18 & 63;
                h2 = bits >> 12 & 63;
                h3 = bits >> 6 & 63;
                h4 = bits & 63;
                tmp_arr[ac++] = b64.charAt(h1) + b64.charAt(h2) + b64.charAt(h3) + b64.charAt(h4)
            } while (i < data.length);
            enc = tmp_arr.join("");
            switch (data.length % 3) {
                case 1:
                    enc = enc.slice(0, -2) + "==";
                    break;
                case 2:
                    enc = enc.slice(0, -1) + "=";
                    break
            }
            return enc
        }
    }
});
StripeCheckout.require.define({
    "lib/tracker": function(exports, require, module) {
        (function() {
            var base64, config, helpers, isEventNameExisting, mixpanel, pixel, stateParameters, trace, traceSerialize, track, tracker, uuid, __indexOf = [].indexOf || function(item) {
                for (var i = 0, l = this.length; i < l; i++) {
                    if (i in this && this[i] === item) return i
                }
                return -1
            };
            uuid = require("lib/uuid");
            pixel = require("lib/pixel");
            base64 = require("vendor/base64");
            helpers = require("lib/helpers");
            config = {
                enabled: false,
                tracingEnabled: false,
                eventNamePrefix: "checkout.",
                distinctId: uuid.generate(),
                mixpanelKey: null
            };
            stateParameters = {};
            tracker = {};
            tracker.setEnabled = function(enabled) {
                return config.enabled = enabled
            };
            tracker.setTracingEnabled = function(enabled) {
                return config.tracingEnabled = enabled
            };
            tracker.setDistinctID = function(value) {
                if (value) {
                    return config.distinctId = value
                }
            };
            tracker.getDistinctID = function() {
                return config.distinctId
            };
            tracker.setMixpanelKey = function(mixpanelKey) {
                return config.mixpanelKey = mixpanelKey
            };
            tracker.track = {
                outerOpen: function(parameters) {
                    var requiredKeys;
                    requiredKeys = ["key"];
                    return track("outer.open", parameters, requiredKeys, {
                        appendStateParameters: false
                    })
                },
                manhattanStatusSet: function(isEnabled) {
                    return track("outer.manhattanStatus", {
                        isEnabled: isEnabled
                    })
                },
                viewport: function(viewport) {
                    return track("outer.viewport", {
                        viewport: viewport
                    })
                },
                iOSWebViewType: function() {
                    var type;
                    type = helpers.getiOSWebViewType();
                    if (type) {
                        return track("inner.iOSWebViewType", {
                            type: type
                        })
                    }
                },
                open: function(options) {
                    var k, v;
                    for (k in options) {
                        v = options[k];
                        stateParameters["option-" + k] = v
                    }
                    return track("open")
                },
                close: function(parameters) {
                    return track("close", parameters, ["withToken"])
                },
                configSummary: function(parameters, options) {
                    var k, v;
                    for (k in options) {
                        v = options[k];
                        stateParameters["option-" + k] = v
                    }
                    return track("config.summary", parameters, ["optchecker-origin", "optchecker-numErrors", "optchecker-numWarnings"])
                },
                configError: function(parameters, options) {
                    var k, v;
                    for (k in options) {
                        v = options[k];
                        stateParameters["option-" + k] = v
                    }
                    return track("config.error", parameters, ["optchecker-origin", "optchecker-result"])
                },
                configWarning: function(parameters, options) {
                    var k, v;
                    for (k in options) {
                        v = options[k];
                        stateParameters["option-" + k] = v
                    }
                    return track("config.warning", parameters, ["optchecker-origin", "optchecker-result"])
                },
                keyOverride: function(values) {
                    return track("config.keyOverride", values, ["configure", "open"])
                },
                localeOverride: function(values) {
                    return track("config.localeOverride", values, ["configure", "open"])
                },
                imageOverride: function(values) {
                    return track("config.imageOverride", values, ["configure", "open"])
                },
                rememberMe: function(parameters) {
                    return track("checkbox.rememberMe", parameters, ["checked"])
                },
                authorizeAccount: function() {
                    return track("account.authorize")
                },
                login: function() {
                    return track("account.authorize.success")
                },
                wrongVerificationCode: function() {
                    return track("account.authorize.fail")
                },
                keepMeLoggedIn: function(parameters) {
                    return track("checkbox.keepMeLoggedIn", parameters, ["checked"])
                },
                logout: function() {
                    return track("account.logout")
                },
                submit: function() {
                    return track("submit")
                },
                invalid: function(parameters) {
                    if (parameters["err"] == null && parameters["fields"] == null) {
                        throw new Error("Cannot track invalid because err or fields should be provided")
                    }
                    return track("invalid", parameters)
                },
                tokenError: function(msg) {
                    return track("token.error", {
                        message: msg,
                        type: "exception"
                    })
                },
                moreInfo: function() {
                    return track("moreInfoLink.click")
                },
                accountCreateSuccess: function() {
                    return track("account.create.success")
                },
                accountCreateFail: function() {
                    return track("account.create.fail")
                },
                addressAutocompleteShow: function() {
                    return track("addressAutoComplete.show")
                },
                addressAutocompleteResultSelected: function() {
                    return track("addressAutocomplete.result.selected")
                },
                back: function(parameters) {
                    return track("back", parameters, ["from_step", "to_step"])
                },
                token: function(parameters) {
                    return track("token", parameters, ["stripe_token"])
                },
                i18nLocKeyMissing: function(key) {
                    return track("i18n.loc.missingKey", {
                        template_key: key
                    })
                },
                i18nLocPartiallyReplacedTemplate: function(key, value) {
                    return track("i18n.loc.partiallyReplacedTemplate", {
                        template_key: key,
                        template_value: value
                    })
                },
                i18nFormatLocaleMissing: function(locale) {
                    return track("i18n.format.localeMissing", {
                        locale: locale
                    })
                },
                phoneVerificationShow: function() {
                    return track("phoneVerification.show")
                },
                phoneVerificationCreate: function(parameters) {
                    return track("phoneVerification.create", parameters, ["use_sms"])
                },
                phoneVerificationAuthorize: function(parameters) {
                    return track("fraudCodeVerification.authorize", parameters, ["valid"])
                },
                addressVerificationShow: function() {
                    return track("addressVerification.show")
                },
                alert: function(parameters) {
                    return track("alert", parameters)
                }
            };
            tracker.trace = {
                trigger: function(eventName, args) {
                    var EXCLUDED_EVENTS;
                    EXCLUDED_EVENTS = ["didResize", "viewAddedToDOM", "valueDidChange", "checkedDidChange", "keyUp", "keyDown", "keyPress", "keyInput", "click", "blur"];
                    eventName = eventName.split(".");
                    if (eventName[eventName.length - 1] === "checkout") {
                        eventName.pop()
                    }
                    eventName = eventName.join(".");
                    if (__indexOf.call(EXCLUDED_EVENTS, eventName) < 0) {
                        if (this._triggerQueue == null) {
                            this._triggerQueue = {}
                        }
                        this._triggerQueue[eventName] = traceSerialize(args);
                        return this._triggerTimeout != null ? this._triggerTimeout : this._triggerTimeout = setTimeout(function(_this) {
                            return function() {
                                var _ref;
                                _ref = _this._triggerQueue;
                                for (eventName in _ref) {
                                    args = _ref[eventName];
                                    trace("trigger." + eventName, {
                                        args: args
                                    })
                                }
                                _this._triggerQueue = {};
                                return _this._triggerTimeout = null
                            }
                        }(this), 0)
                    }
                },
                rpcInvoke: function(method) {
                    return trace("rpc.invoke." + method)
                },
                rpcPostMessage: function(method, args, id) {
                    return trace("rpc.postMessage." + method, {
                        id: id,
                        args: traceSerialize(args)
                    })
                }
            };
            tracker.state = {
                setUIType: function(type) {
                    return stateParameters["st-ui-type"] = type
                },
                setUIIntegration: function(integration) {
                    return stateParameters["st-ui-integration"] = integration
                },
                setAccountsEnabled: function(bool) {
                    return stateParameters["st-accounts-enabled"] = bool
                },
                setRememberMeEnabled: function(bool) {
                    return stateParameters["st-remember-me-enabled"] = bool
                },
                setRememberMeChecked: function(bool) {
                    return stateParameters["st-remember-me-checked"] = bool
                },
                setAccountCreated: function(bool) {
                    return stateParameters["st-account-created"] = bool
                },
                setLoggedIn: function(bool) {
                    return stateParameters["st-logged-in"] = bool
                },
                setVariants: function(variants) {
                    var k, v, _results;
                    _results = [];
                    for (k in variants) {
                        v = variants[k];
                        _results.push(stateParameters["st-variant-" + k] = v)
                    }
                    return _results
                },
                setPhoneVerificationShown: function(bool) {
                    return stateParameters["st-phone-verification-shown"] = bool
                },
                setAddressVerificationShown: function(bool) {
                    return stateParameters["st-address-verification-shown"] = bool
                },
                setAlipayShouldDisplay: function(bool) {
                    return stateParameters["st-alipay-should-display"] = bool
                },
                setRequestedLocale: function(locale) {
                    return stateParameters["st-locale"] = locale
                }
            };
            tracker.dontTrack = function(fn) {
                var enabled;
                enabled = config.enabled;
                config.enabled = false;
                fn();
                return config.enabled = enabled
            };
            isEventNameExisting = function(eventName) {
                var exists, k, v, _ref;
                exists = false;
                _ref = tracker.events;
                for (k in _ref) {
                    v = _ref[k];
                    if (v === eventName) {
                        exists = true;
                        break
                    }
                }
                return exists
            };
            trace = function(eventName, parameters, requiredKeys, options) {
                if (parameters == null) {
                    parameters = {}
                }
                if (requiredKeys == null) {
                    requiredKeys = []
                }
                if (options == null) {
                    options = {}
                }
                if (!config.tracingEnabled) {
                    return
                }
                eventName = "trace." + eventName;
                options.excludeMixpanel = true;
                return track.apply(this, arguments)
            };
            track = function(eventName, parameters, requiredKeys, options) {
                var fullEventName, k, key, missingKeys, v, _i, _len;
                if (parameters == null) {
                    parameters = {}
                }
                if (requiredKeys == null) {
                    requiredKeys = []
                }
                if (options == null) {
                    options = {}
                }
                if (!config.enabled) {
                    return
                }
                missingKeys = function() {
                    var _i, _len, _results;
                    _results = [];
                    for (_i = 0, _len = requiredKeys.length; _i < _len; _i++) {
                        key = requiredKeys[_i];
                        if (!(key in parameters)) {
                            _results.push(key)
                        }
                    }
                    return _results
                }();
                if (missingKeys.length > 0) {
                    throw new Error("Missing required data (" + missingKeys.join(", ") + ") for tracking " + eventName + ".")
                }
                parameters.distinct_id = config.distinctId;
                parameters.eventId = uuid.generate();
                if (options.appendStateParameters == null) {
                    options.appendStateParameters = true
                }
                if (options.appendStateParameters) {
                    for (k in stateParameters) {
                        v = stateParameters[k];
                        parameters[k] = v
                    }
                }
                parameters.h = screen.height;
                parameters.w = screen.width;
                for (v = _i = 0, _len = parameters.length; _i < _len; v = ++_i) {
                    k = parameters[v];
                    if (v instanceof Array) {
                        v.sort()
                    }
                }
                fullEventName = "" + config.eventNamePrefix + eventName;
                if (!options.excludeMixpanel) {
                    mixpanel.track(fullEventName, parameters)
                }
                return pixel.track(fullEventName, parameters)
            };
            mixpanel = {};
            mixpanel.track = function(eventName, options) {
                var dataStr, properties;
                if (options == null) {
                    options = {}
                }
                if (!(typeof $ !== "undefined" && $ !== null && config.mixpanelKey != null)) {
                    return
                }
                properties = $.extend({
                    token: config.mixpanelKey,
                    userAgent: window.navigator.userAgent
                }, options);
                delete properties["stripe_token"];
                dataStr = base64.encode(JSON.stringify({
                    event: eventName,
                    properties: properties
                }));
                return (new Image).src = "https://api.mixpanel.com/track/?ip=1&img=1&data=" + dataStr
            };
            traceSerialize = function(value) {
                var k, obj, v;
                if (value instanceof Array) {
                    return JSON.stringify(function() {
                        var _i, _len, _results;
                        _results = [];
                        for (_i = 0, _len = value.length; _i < _len; _i++) {
                            v = value[_i];
                            _results.push(traceSerialize(v))
                        }
                        return _results
                    }())
                } else if (value != null && value.target != null && value.type != null) {
                    return traceSerialize({
                        type: value.type,
                        target_id: value.target.id
                    })
                } else if (value instanceof Object) {
                    if (value.constructor === Object) {
                        obj = {};
                        for (k in value) {
                            v = value[k];
                            obj[k] = traceSerialize(v)
                        }
                        return JSON.stringify(obj)
                    } else {
                        return value.toString()
                    }
                } else {
                    return value
                }
            };
            module.exports = tracker
        }).call(this)
    }
});
StripeCheckout.require.define({
    "outer/lib/fallbackRpc": function(exports, require, module) {
        (function() {
            var FallbackRPC, cacheBust, interval, lastHash, re, __bind = function(fn, me) {
                return function() {
                    return fn.apply(me, arguments)
                }
            };
            cacheBust = 1;
            interval = null;
            lastHash = null;
            re = /^#?\d+&/;
            FallbackRPC = function() {
                function FallbackRPC(target, host) {
                    this.invokeTarget = __bind(this.invokeTarget, this);
                    this.target = target;
                    this.host = host
                }
                FallbackRPC.prototype.invokeTarget = function(message) {
                    var url;
                    message = +new Date + cacheBust++ + "&" + encodeURIComponent(message);
                    url = this.host + "";
                    return this.target.location = url.replace(/#.*$/, "") + "#" + message
                };
                FallbackRPC.prototype.receiveMessage = function(callback, delay) {
                    if (delay == null) {
                        delay = 100
                    }
                    interval && clearInterval(interval);
                    return interval = setInterval(function() {
                        var hash;
                        hash = decodeURIComponent(window.location.hash);
                        if (hash !== lastHash && re.test(hash)) {
                            window.location.hash = "";
                            lastHash = hash;
                            return callback({
                                data: hash.replace(re, "")
                            })
                        }
                    }, delay)
                };
                return FallbackRPC
            }();
            module.exports = FallbackRPC
        }).call(this)
    }
});
StripeCheckout.require.define({
    "outer/lib/utils": function(exports, require, module) {
        (function() {
            var $, $$, addClass, append, css, hasAttr, hasClass, insertAfter, insertBefore, parents, remove, resolve, text, trigger, __indexOf = [].indexOf || function(item) {
                for (var i = 0, l = this.length; i < l; i++) {
                    if (i in this && this[i] === item) return i
                }
                return -1
            };
            $ = function(sel) {
                return document.querySelectorAll(sel)
            };
            $$ = function(cls) {
                var el, reg, _i, _len, _ref, _results;
                if (typeof document.getElementsByClassName === "function") {
                    return document.getElementsByClassName(cls)
                } else if (typeof document.querySelectorAll === "function") {
                    return document.querySelectorAll("." + cls)
                } else {
                    reg = new RegExp("(^|\\s)" + cls + "(\\s|$)");
                    _ref = document.getElementsByTagName("*");
                    _results = [];
                    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
                        el = _ref[_i];
                        if (reg.test(el.className)) {
                            _results.push(el)
                        }
                    }
                    return _results
                }
            };
            hasAttr = function(element, attr) {
                var node;
                if (typeof element.hasAttribute === "function") {
                    return element.hasAttribute(attr)
                } else {
                    node = element.getAttributeNode(attr);
                    return !!(node && (node.specified || node.nodeValue))
                }
            };
            trigger = function(element, name, data, bubble) {
                if (data == null) {
                    data = {}
                }
                if (bubble == null) {
                    bubble = true
                }
                if (window.jQuery) {
                    return jQuery(element).trigger(name, data)
                }
            };
            addClass = function(element, name) {
                return element.className += " " + name
            };
            hasClass = function(element, name) {
                return __indexOf.call(element.className.split(" "), name) >= 0
            };
            css = function(element, css) {
                return element.style.cssText += ";" + css
            };
            insertBefore = function(element, child) {
                return element.parentNode.insertBefore(child, element)
            };
            insertAfter = function(element, child) {
                return element.parentNode.insertBefore(child, element.nextSibling)
            };
            append = function(element, child) {
                return element.appendChild(child)
            };
            remove = function(element) {
                var _ref;
                return (_ref = element.parentNode) != null ? _ref.removeChild(element) : void 0
            };
            parents = function(node) {
                var ancestors;
                ancestors = [];
                while ((node = node.parentNode) && node !== document && __indexOf.call(ancestors, node) < 0) {
                    ancestors.push(node)
                }
                return ancestors
            };
            resolve = function(url) {
                var parser;
                parser = document.createElement("a");
                parser.href = url;
                return "" + parser.href
            };
            text = function(element, value) {
                if ("innerText" in element) {
                    element.innerText = value
                } else {
                    element.textContent = value
                }
                return value
            };
            module.exports = {
                $: $,
                $$: $$,
                hasAttr: hasAttr,
                trigger: trigger,
                addClass: addClass,
                hasClass: hasClass,
                css: css,
                insertBefore: insertBefore,
                insertAfter: insertAfter,
                append: append,
                remove: remove,
                parents: parents,
                resolve: resolve,
                text: text
            }
        }).call(this)
    }
});
StripeCheckout.require.define({
    "outer/controllers/app": function(exports, require, module) {
        (function() {
            var App, Checkout, RPC, TokenCallback, optionParser, tracker, utils, __bind = function(fn, me) {
                return function() {
                    return fn.apply(me, arguments)
                }
            };
            Checkout = require("outer/controllers/checkout");
            TokenCallback = require("outer/controllers/tokenCallback");
            RPC = require("lib/rpc");
            optionParser = require("lib/optionParser");
            tracker = require("lib/tracker");
            utils = require("outer/lib/utils");
            App = function() {
                function App(options) {
                    var _ref, _ref1;
                    if (options == null) {
                        options = {}
                    }
                    this.setForceAppType = __bind(this.setForceAppType, this);
                    this.setForceView = __bind(this.setForceView, this);
                    this.setForceManhattan = __bind(this.setForceManhattan, this);
                    this.getHost = __bind(this.getHost, this);
                    this.setHost = __bind(this.setHost, this);
                    this.configure = __bind(this.configure, this);
                    this.close = __bind(this.close, this);
                    this.open = __bind(this.open, this);
                    this.configurations = {};
                    this.checkouts = {};
                    this.constructorOptions = {
                        host: "https://checkout.stripe.com",
                        forceManhattan: false,
                        forceView: false,
                        forceAppType: false
                    };
                    this.timeLoaded = Math.floor((new Date).getTime() / 1e3);
                    this.totalButtons = 0;
                    if (((_ref = window.Prototype) != null ? (_ref1 = _ref.Version) != null ? _ref1.indexOf("1.6") : void 0 : void 0) === 0) {
                        console.error("Stripe Checkout is not compatible with your version of Prototype.js. Please upgrade to version 1.7 or greater.")
                    }
                }
                App.prototype.open = function(options, buttonId) {
                    var checkout, k, mergedOptions, v, _ref;
                    if (options == null) {
                        options = {}
                    }
                    if (buttonId == null) {
                        buttonId = null
                    }
                    mergedOptions = {
                        referrer: document.referrer,
                        url: document.URL,
                        timeLoaded: this.timeLoaded
                    };
                    if (buttonId && this.configurations[buttonId]) {
                        _ref = this.configurations[buttonId];
                        for (k in _ref) {
                            v = _ref[k];
                            mergedOptions[k] = v
                        }
                    }
                    for (k in options) {
                        v = options[k];
                        mergedOptions[k] = v
                    }
                    if (mergedOptions.image) {
                        mergedOptions.image = utils.resolve(mergedOptions.image)
                    }
                    optionParser.checkUsage("open", mergedOptions);
                    this.validateOptions(options, "open");
                    if (buttonId) {
                        checkout = this.checkouts[buttonId];
                        if (options.token != null || options.onToken != null) {
                            checkout.setOnToken(new TokenCallback(options))
                        }
                    } else {
                        checkout = new Checkout(new TokenCallback(options), this.constructorOptions, options)
                    }
                    this.trackOpen(checkout, mergedOptions);
                    this.trackViewport();
                    return checkout.open(mergedOptions)
                };
                App.prototype.close = function(buttonId) {
                    var _ref;
                    return (_ref = this.checkouts[buttonId]) != null ? _ref.close() : void 0
                };
                App.prototype.configure = function(buttonId, options) {
                    if (options == null) {
                        options = {}
                    }
                    if (buttonId instanceof Object) {
                        options = buttonId;
                        buttonId = "button" + this.totalButtons++
                    }
                    this.enableTracker(options);
                    optionParser.checkUsage("configure", options);
                    if (options.image) {
                        options.image = utils.resolve(options.image)
                    }
                    this.validateOptions(options, "configure");
                    this.configurations[buttonId] = options;
                    this.checkouts[buttonId] = new Checkout(new TokenCallback(options), this.constructorOptions, options);
                    this.checkouts[buttonId].preload(options);
                    return {
                        open: function(_this) {
                            return function(options) {
                                return _this.open(options, buttonId)
                            }
                        }(this),
                        close: function(_this) {
                            return function() {
                                return _this.close(buttonId)
                            }
                        }(this)
                    }
                };
                App.prototype.validateOptions = function(options, which) {
                    var url;
                    try {
                        return JSON.stringify(options)
                    } catch (_error) {
                        url = "https://stripe.com/docs/checkout#integration-custom";
                        throw new Error("Stripe Checkout was unable to serialize the options passed to StripeCheckout." + which + "(). Please consult the doumentation to confirm that you're supplying values of the expected type: " + url)
                    }
                };
                App.prototype.setHost = function(host) {
                    return this.constructorOptions.host = host
                };
                App.prototype.getHost = function() {
                    return this.constructorOptions.host
                };
                App.prototype.setForceManhattan = function(force) {
                    return this.constructorOptions.forceManhattan = !!force
                };
                App.prototype.setForceView = function(force) {
                    return this.constructorOptions.forceView = force
                };
                App.prototype.setForceAppType = function(force) {
                    return this.constructorOptions.forceAppType = force
                };
                App.prototype.enableTracker = function(options) {
                    return tracker.setEnabled(!options.notrack)
                };
                App.prototype.trackOpen = function(checkout, options) {
                    this.enableTracker(options);
                    return tracker.track.outerOpen({
                        key: options.key,
                        lsid: "NA",
                        cid: "NA"
                    })
                };
                App.prototype.trackViewport = function(checkout, options) {
                    var metaTags, tag, viewport, viewportContent;
                    metaTags = document.getElementsByTagName("meta");
                    viewportContent = function() {
                        var _i, _len, _results;
                        _results = [];
                        for (_i = 0, _len = metaTags.length; _i < _len; _i++) {
                            tag = metaTags[_i];
                            if (tag.name === "viewport" && !!tag.content) {
                                _results.push(tag.content)
                            }
                        }
                        return _results
                    }().join(",");
                    try {
                        viewport = viewportContent.split(",").map(function(t) {
                            return t.trim().toLowerCase()
                        }).sort().join(", ");
                        return tracker.track.viewport(viewport)
                    } catch (_error) {}
                };
                return App
            }();
            module.exports = App
        }).call(this)
    }
});
StripeCheckout.require.define({
    "outer/controllers/button": function(exports, require, module) {
        (function() {
            var $$, Button, addClass, append, hasAttr, hasClass, helpers, insertAfter, optionParser, parents, resolve, text, trigger, _ref, __bind = function(fn, me) {
                return function() {
                    return fn.apply(me, arguments)
                }
            };
            _ref = require("outer/lib/utils"), $$ = _ref.$$, hasClass = _ref.hasClass, addClass = _ref.addClass, trigger = _ref.trigger, append = _ref.append, text = _ref.text, parents = _ref.parents, insertAfter = _ref.insertAfter, hasAttr = _ref.hasAttr, resolve = _ref.resolve;
            helpers = require("lib/helpers");
            optionParser = require("lib/optionParser");
            Button = function() {
                Button.totalButtonId = 0;
                Button.load = function(app) {
                    var button, el, element;
                    element = $$("stripe-button");
                    element = function() {
                        var _i, _len, _results;
                        _results = [];
                        for (_i = 0, _len = element.length; _i < _len; _i++) {
                            el = element[_i];
                            if (!hasClass(el, "active")) {
                                _results.push(el)
                            }
                        }
                        return _results
                    }();
                    element = element[element.length - 1];
                    if (!element) {
                        return
                    }
                    addClass(element, "active");
                    button = new Button(element, app);
                    return button.append()
                };

                function Button(scriptEl, app) {
                    this.parseOptions = __bind(this.parseOptions, this);
                    this.parentHead = __bind(this.parentHead, this);
                    this.parentForm = __bind(this.parentForm, this);
                    this.onToken = __bind(this.onToken, this);
                    this.open = __bind(this.open, this);
                    this.submit = __bind(this.submit, this);
                    this.append = __bind(this.append, this);
                    this.render = __bind(this.render, this);
                    var _base;
                    this.scriptEl = scriptEl;
                    this.app = app;
                    this.document = this.scriptEl.ownerDocument;
                    this.nostyle = helpers.isFallback();
                    this.options = this.parseOptions();
                    (_base = this.options).label || (_base.label = "Pay with Card");
                    this.options.token = this.onToken;
                    this.options.buttonIntegration = true;
                    this.$el = document.createElement("button");
                    this.$el.setAttribute("type", "submit");
                    this.$el.className = "stripe-button-el";
                    helpers.bind(this.$el, "click", this.submit);
                    helpers.bind(this.$el, "touchstart", function() {});
                    this.render()
                }
                Button.prototype.render = function() {
                    this.$el.innerHTML = "";
                    this.$span = document.createElement("span");
                    text(this.$span, this.options.label);
                    if (!this.nostyle) {
                        this.$el.style.visibility = "hidden";
                        this.$span.style.display = "block";
                        this.$span.style.minHeight = "30px"
                    }
                    this.$style = document.createElement("link");
                    this.$style.setAttribute("type", "text/css");
                    this.$style.setAttribute("rel", "stylesheet");
                    this.$style.setAttribute("href", this.app.getHost() + "/v3/checkout/button-qpwW2WfkB0oGWVWIASjIOQ.css");
                    return append(this.$el, this.$span)
                };
                Button.prototype.append = function() {
                    var head;
                    if (this.scriptEl) {
                        insertAfter(this.scriptEl, this.$el)
                    }
                    if (!this.nostyle) {
                        head = this.parentHead();
                        if (head) {
                            append(head, this.$style)
                        }
                    }
                    if (this.$form = this.parentForm()) {
                        helpers.unbind(this.$form, "submit", this.submit);
                        helpers.bind(this.$form, "submit", this.submit)
                    }
                    if (!this.nostyle) {
                        setTimeout(function(_this) {
                            return function() {
                                return _this.$el.style.visibility = "visible"
                            }
                        }(this), 1e3)
                    }
                    this.app.setHost(helpers.host(this.scriptEl.src));
                    return this.appHandler = this.app.configure(this.options, {
                        form: this.$form
                    })
                };
                Button.prototype.disable = function() {
                    return this.$el.setAttribute("disabled", true)
                };
                Button.prototype.enable = function() {
                    return this.$el.removeAttribute("disabled")
                };
                Button.prototype.isDisabled = function() {
                    return hasAttr(this.$el, "disabled")
                };
                Button.prototype.submit = function(e) {
                    if (typeof e.preventDefault === "function") {
                        e.preventDefault()
                    }
                    if (!this.isDisabled()) {
                        this.open()
                    }
                    return false
                };
                Button.prototype.open = function() {
                    return this.appHandler.open(this.options)
                };
                Button.prototype.onToken = function(token, args) {
                    var $input, $tokenInput, $tokenTypeInput, key, value;
                    trigger(this.scriptEl, "token", token);
                    if (this.$form) {
                        $tokenInput = this.renderInput("stripeToken", token.id);
                        append(this.$form, $tokenInput);
                        $tokenTypeInput = this.renderInput("stripeTokenType", token.type);
                        append(this.$form, $tokenTypeInput);
                        if (token.email) {
                            append(this.$form, this.renderInput("stripeEmail", token.email))
                        }
                        if (args) {
                            for (key in args) {
                                value = args[key];
                                $input = this.renderInput(this.formatKey(key), value);
                                append(this.$form, $input)
                            }
                        }
                        this.$form.submit()
                    }
                    return this.disable()
                };
                Button.prototype.formatKey = function(key) {
                    var arg, args, _i, _len;
                    args = key.split("_");
                    key = "";
                    for (_i = 0, _len = args.length; _i < _len; _i++) {
                        arg = args[_i];
                        if (arg.length > 0) {
                            key = key + arg.substr(0, 1).toUpperCase() + arg.substr(1).toLowerCase()
                        }
                    }
                    return "stripe" + key
                };
                Button.prototype.renderInput = function(name, value) {
                    var input;
                    input = document.createElement("input");
                    input.type = "hidden";
                    input.name = name;
                    input.value = value;
                    return input
                };
                Button.prototype.parentForm = function() {
                    var el, elements, _i, _len, _ref1;
                    elements = parents(this.$el);
                    for (_i = 0, _len = elements.length; _i < _len; _i++) {
                        el = elements[_i];
                        if (((_ref1 = el.tagName) != null ? _ref1.toLowerCase() : void 0) === "form") {
                            return el
                        }
                    }
                    return null
                };
                Button.prototype.parentHead = function() {
                    var _ref1, _ref2;
                    return ((_ref1 = this.document) != null ? _ref1.head : void 0) || ((_ref2 = this.document) != null ? _ref2.getElementsByTagName("head")[0] : void 0) || this.document.body
                };
                Button.prototype.parseOptions = function() {
                    var attr, camelOption, coercedValue, match, options, val, _i, _len, _ref1;
                    options = {};
                    _ref1 = this.scriptEl.attributes;
                    for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
                        attr = _ref1[_i];
                        match = attr.name.match(/^data-(.+)$/);
                        if (match != null ? match[1] : void 0) {
                            camelOption = helpers.dashToCamelCase(match[1]);
                            if (camelOption === "image") {
                                if (attr.value) {
                                    val = resolve(attr.value)
                                }
                            } else {
                                val = attr.value
                            }
                            coercedValue = optionParser.coerceButtonOption(camelOption, val);
                            options[camelOption] = coercedValue;
                            if (options.__originals == null) {
                                options.__originals = {}
                            }
                            options.__originals[camelOption] = match[0]
                        }
                    }
                    return options
                };
                return Button
            }();
            module.exports = Button
        }).call(this)
    }
});
StripeCheckout.require.define({
    "outer/controllers/checkout": function(exports, require, module) {
        (function() {
            var Checkout, FallbackView, IframeView, TabView, helpers, tracker, __bind = function(fn, me) {
                return function() {
                    return fn.apply(me, arguments)
                }
            };
            helpers = require("lib/helpers");
            IframeView = require("outer/views/iframeView");
            TabView = require("outer/views/tabView");
            FallbackView = require("outer/views/fallbackView");
            tracker = require("lib/tracker");
            Checkout = function() {
                Checkout.activeView = null;

                function Checkout(tokenCallback, options, configOptions) {
                    this.shouldUseManhattan = __bind(this.shouldUseManhattan, this);
                    this.isLegacyIe = __bind(this.isLegacyIe, this);
                    this.invokeCallbacks = __bind(this.invokeCallbacks, this);
                    this.onTokenCallback = __bind(this.onTokenCallback, this);
                    this.preload = __bind(this.preload, this);
                    this.open = __bind(this.open, this);
                    this.createView = __bind(this.createView, this);
                    this.setOnToken = __bind(this.setOnToken, this);
                    this.host = options.host;
                    this.forceManhattan = options.forceManhattan;
                    this.forceView = options.forceView;
                    this.forceAppType = options.forceAppType;
                    this.opened = false;
                    this.setOnToken(tokenCallback);
                    this.shouldPopup = helpers.isSupportedMobileOS() && !(helpers.isNativeWebContainer() || helpers.isAndroidWebapp() || helpers.isAndroidFacebookApp() || helpers.isiOSWebView() || helpers.isiOSBroken());
                    this.manhattanPending = false;
                    this.manhattanCallbacks = [];
                    this.shouldUseManhattan(this.createView, configOptions)
                }
                Checkout.prototype.setOnToken = function(tokenCallback) {
                    var _ref;
                    this.tokenCallback = tokenCallback;
                    this.onToken = function(_this) {
                        return function(data) {
                            return tokenCallback.trigger(data.token, data.args, _this.onTokenCallback)
                        }
                    }(this);
                    return (_ref = this.view) != null ? _ref.onToken = this.onToken : void 0
                };
                Checkout.prototype.createView = function(useManhattan) {
                    var forceViewClass, path, viewClass, views;
                    if (useManhattan == null) {
                        useManhattan = false
                    }
                    if (this.view != null) {
                        return
                    }
                    tracker.track.manhattanStatusSet(useManhattan);
                    views = {
                        FallbackView: FallbackView,
                        IframeView: IframeView,
                        TabView: TabView
                    };
                    forceViewClass = views[this.forceView];
                    viewClass = function() {
                        switch (false) {
                            case !forceViewClass:
                                return forceViewClass;
                            case !helpers.isFallback():
                                return FallbackView;
                            case !this.shouldPopup:
                                return TabView;
                            default:
                                return IframeView
                        }
                    }.call(this);
                    path = function() {
                        switch (false) {
                            case viewClass !== FallbackView:
                                return "/v3/fallback/x3lCd9pszoV9w7GNMLb9QA.html";
                            case !useManhattan:
                                return "/m/v3/index-1462639fe58b3eafa4c3.html";
                            default:
                                return "/v3/jJl0ZIDdFth0NwJwfZkUA.html"
                        }
                    }();
                    path = "" + path + "?distinct_id=" + tracker.getDistinctID();
                    if (this.forceAppType) {
                        path = "" + path + "?force_app_type=" + this.forceAppType
                    }
                    this.view = new viewClass(this.onToken, this.host, path);
                    if (this.preloadOptions != null) {
                        this.view.preload(this.preloadOptions);
                        return this.preloadOptions = null
                    }
                };
                Checkout.prototype.open = function(options) {
                    var cb;
                    if (options == null) {
                        options = {}
                    }
                    cb = function(_this) {
                        return function() {
                            var iframeFallback;
                            _this.opened = true;
                            if (Checkout.activeView && Checkout.activeView !== _this.view) {
                                Checkout.activeView.close()
                            }
                            Checkout.activeView = _this.view;
                            options.supportsTokenCallback = _this.tokenCallback.supportsTokenCallback();
                            iframeFallback = function() {
                                if (!(this.view instanceof TabView)) {
                                    return
                                }
                                this.view = new IframeView(this.onToken, this.host, "/v3/jJl0ZIDdFth0NwJwfZkUA.html");
                                return this.open(options)
                            };
                            if (helpers.isiOSChrome() && !helpers.isUserGesture()) {
                                return iframeFallback()
                            }
                            return _this.view.open(options, function(status) {
                                if (!status) {
                                    return iframeFallback()
                                }
                            })
                        }
                    }(this);
                    if (this.manhattanPending) {
                        return this.manhattanCallbacks.push(cb)
                    } else {
                        return cb()
                    }
                };
                Checkout.prototype.close = function() {
                    var _ref;
                    return (_ref = this.view) != null ? _ref.close() : void 0
                };
                Checkout.prototype.preload = function(options) {
                    if (this.view != null) {
                        return this.view.preload(options)
                    } else {
                        return this.preloadOptions = options
                    }
                };
                Checkout.prototype.onTokenCallback = function() {
                    return this.view.triggerTokenCallback.apply(this.view, arguments)
                };
                Checkout.prototype.invokeCallbacks = function() {
                    var callback, _i, _len, _ref;
                    _ref = this.manhattanCallbacks;
                    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
                        callback = _ref[_i];
                        callback()
                    }
                    this.manhattanCallbacks = [];
                    return this.manhattanPending = false
                };
                Checkout.prototype.isLegacyIe = function() {
                    return !(window.XMLHttpRequest != null && (new XMLHttpRequest).withCredentials != null)
                };
                Checkout.prototype.shouldUseManhattan = function(cb, options) {
                    var handleResponseText, key, req, url, value;
                    this.manhattanPending = true;
                    setTimeout(function(_this) {
                        return function() {
                            _this.createView();
                            return _this.invokeCallbacks()
                        }
                    }(this), 3e3);
                    if (helpers.isFallback() || this.shouldPopup) {
                        cb(false);
                        this.invokeCallbacks();
                        return
                    }
                    if (this.manhattanFlagState != null) {
                        cb(this.manhattanFlagState);
                        this.invokeCallbacks()
                    }
                    handleResponseText = function(_this) {
                        return function(rt) {
                            var data;
                            try {
                                data = JSON.parse(rt);
                                if (_this.forceManhattan === true) {
                                    return _this.manhattanFlagState = _this.forceManhattan
                                } else {
                                    return _this.manhattanFlagState = !!data.is_on
                                }
                            } catch (_error) {
                                return _this.manhattanFlagState = false
                            }
                        }
                    }(this);
                    if (this.isLegacyIe()) {
                        if (window.location.protocol !== "https:") {
                            cb();
                            return
                        }
                        req = new window.XDomainRequest;
                        req.onload = function(_this) {
                            return function() {
                                try {
                                    handleResponseText(req.responseText);
                                    cb(_this.manhattanFlagState)
                                } catch (_error) {
                                    cb()
                                }
                                return _this.invokeCallbacks()
                            }
                        }(this)
                    } else {
                        req = new XMLHttpRequest;
                        req.onreadystatechange = function(_this) {
                            return function() {
                                if (req.readyState !== 4) {
                                    return
                                }
                                if (req.status === 200) {
                                    handleResponseText(req.responseText)
                                } else {
                                    _this.manhattanFlagState = false
                                }
                                cb(_this.manhattanFlagState);
                                return _this.invokeCallbacks()
                            }
                        }(this)
                    }
                    url = this.host + "/api/outer/manhattan";
                    for (key in options) {
                        value = options[key];
                        if (key !== "token" && key !== "opened" && key !== "closed") {
                            url = helpers.addQueryParameter(url, key, value)
                        }
                    }
                    req.open("GET", url, true);
                    return req.send()
                };
                return Checkout
            }();
            module.exports = Checkout
        }).call(this)
    }
});
StripeCheckout.require.define({
    "outer/controllers/tokenCallback": function(exports, require, module) {
        (function() {
            var TokenCallback, __bind = function(fn, me) {
                return function() {
                    return fn.apply(me, arguments)
                }
            };
            TokenCallback = function() {
                function TokenCallback(options) {
                    this.supportsTokenCallback = __bind(this.supportsTokenCallback, this);
                    this.trigger = __bind(this.trigger, this);
                    if (options.token) {
                        this.fn = options.token;
                        this.version = 1
                    } else if (options.onToken) {
                        this.fn = options.onToken;
                        this.version = 2
                    }
                }
                TokenCallback.prototype.trigger = function(token, addresses, callback) {
                    var data, k, shipping, v;
                    if (this.version === 2) {
                        data = {
                            token: token
                        };
                        shipping = null;
                        for (k in addresses) {
                            v = addresses[k];
                            if (/^shipping_/.test(k)) {
                                if (shipping == null) {
                                    shipping = {}
                                }
                                shipping[k.replace(/^shipping_/, "")] = v
                            }
                        }
                        if (shipping != null) {
                            data.shipping = shipping
                        }
                        return this.fn(data, callback)
                    } else {
                        return this.fn(token, addresses)
                    }
                };
                TokenCallback.prototype.supportsTokenCallback = function() {
                    return this.version > 1
                };
                return TokenCallback
            }();
            module.exports = TokenCallback
        }).call(this)
    }
});
StripeCheckout.require.define({
    "outer/views/fallbackView": function(exports, require, module) {
        (function() {
            var FallbackRPC, FallbackView, View, __bind = function(fn, me) {
                    return function() {
                        return fn.apply(me, arguments)
                    }
                },
                __hasProp = {}.hasOwnProperty,
                __extends = function(child, parent) {
                    for (var key in parent) {
                        if (__hasProp.call(parent, key)) child[key] = parent[key]
                    }

                    function ctor() {
                        this.constructor = child
                    }
                    ctor.prototype = parent.prototype;
                    child.prototype = new ctor;
                    child.__super__ = parent.prototype;
                    return child
                };
            FallbackRPC = require("outer/lib/fallbackRpc");
            View = require("outer/views/view");
            FallbackView = function(_super) {
                __extends(FallbackView, _super);

                function FallbackView() {
                    this.triggerTokenCallback = __bind(this.triggerTokenCallback, this);
                    this.close = __bind(this.close, this);
                    this.open = __bind(this.open, this);
                    FallbackView.__super__.constructor.apply(this, arguments)
                }
                FallbackView.prototype.open = function(options, callback) {
                    var message, url;
                    FallbackView.__super__.open.apply(this, arguments);
                    url = this.host + this.path;
                    this.frame = window.open(url, "stripe_checkout_app", "width=400,height=400,location=yes,resizable=yes,scrollbars=yes");
                    if (this.frame == null) {
                        alert("Disable your popup blocker to proceed with checkout.");
                        url = "https://stripe.com/docs/checkout#integration-more-runloop";
                        throw new Error("To learn how to prevent the Stripe Checkout popup from being blocked, please visit " + url)
                    }
                    this.rpc = new FallbackRPC(this.frame, url);
                    this.rpc.receiveMessage(function(_this) {
                        return function(e) {
                            var data;
                            try {
                                data = JSON.parse(e.data)
                            } catch (_error) {
                                return
                            }
                            return _this.onToken(data)
                        }
                    }(this));
                    message = JSON.stringify(this.options);
                    this.rpc.invokeTarget(message);
                    return callback(true)
                };
                FallbackView.prototype.close = function() {
                    var _ref;
                    return (_ref = this.frame) != null ? _ref.close() : void 0
                };
                FallbackView.prototype.triggerTokenCallback = function(err) {
                    if (err) {
                        return alert(err)
                    }
                };
                return FallbackView
            }(View);
            module.exports = FallbackView
        }).call(this)
    }
});
StripeCheckout.require.define({
    "outer/views/iframeView": function(exports, require, module) {
        (function() {
            var IframeView, RPC, View, helpers, ready, utils, __bind = function(fn, me) {
                    return function() {
                        return fn.apply(me, arguments)
                    }
                },
                __hasProp = {}.hasOwnProperty,
                __extends = function(child, parent) {
                    for (var key in parent) {
                        if (__hasProp.call(parent, key)) child[key] = parent[key]
                    }

                    function ctor() {
                        this.constructor = child
                    }
                    ctor.prototype = parent.prototype;
                    child.prototype = new ctor;
                    child.__super__ = parent.prototype;
                    return child
                };
            utils = require("outer/lib/utils");
            helpers = require("lib/helpers");
            RPC = require("lib/rpc");
            View = require("outer/views/view");
            ready = require("vendor/ready");
            IframeView = function(_super) {
                __extends(IframeView, _super);

                function IframeView() {
                    this.configure = __bind(this.configure, this);
                    this.removeFrame = __bind(this.removeFrame, this);
                    this.removeTouchOverlay = __bind(this.removeTouchOverlay, this);
                    this.showTouchOverlay = __bind(this.showTouchOverlay, this);
                    this.attachIframe = __bind(this.attachIframe, this);
                    this.setToken = __bind(this.setToken, this);
                    this.closed = __bind(this.closed, this);
                    this.close = __bind(this.close, this);
                    this.preload = __bind(this.preload, this);
                    this.opened = __bind(this.opened, this);
                    this.open = __bind(this.open, this);
                    return IframeView.__super__.constructor.apply(this, arguments)
                }
                IframeView.prototype.open = function(options, callback) {
                    IframeView.__super__.open.apply(this, arguments);
                    return ready(function(_this) {
                        return function() {
                            var left, loaded, _ref;
                            _this.originalOverflowValue = document.body.style.overflow;
                            if (_this.frame == null) {
                                _this.configure()
                            }
                            if (typeof $ !== "undefined" && $ !== null ? (_ref = $.fn) != null ? _ref.modal : void 0 : void 0) {
                                $(document).off("focusin.bs.modal").off("focusin.modal")
                            }
                            _this.frame.style.display = "block";
                            if (_this.shouldShowTouchOverlay()) {
                                _this.showTouchOverlay();
                                left = window.scrollX || window.pageXOffset;
                                if (_this.iframeWidth() < window.innerWidth) {
                                    left += (window.innerWidth - _this.iframeWidth()) / 2
                                }
                                _this.frame.style.top = (window.scrollY || window.pageYOffset) + "px";
                                _this.frame.style.left = left + "px"
                            }
                            loaded = false;
                            setTimeout(function() {
                                if (loaded) {
                                    return
                                }
                                loaded = true;
                                callback(false);
                                return _this.removeFrame()
                            }, 8e3);
                            return _this.rpc.ready(function() {
                                if (loaded) {
                                    return
                                }
                                loaded = true;
                                callback(true);
                                _this.rpc.invoke("render", "", "iframe", _this.options);
                                if (helpers.isIE()) {
                                    document.body.style.overflow = "hidden"
                                }
                                return _this.rpc.invoke("open", {
                                    timeLoaded: _this.options.timeLoaded
                                })
                            })
                        }
                    }(this))
                };
                IframeView.prototype.opened = function() {
                    var _base;
                    return typeof(_base = this.options).opened === "function" ? _base.opened() : void 0
                };
                IframeView.prototype.preload = function(options) {
                    return ready(function(_this) {
                        return function() {
                            _this.configure();
                            return _this.rpc.invoke("preload", options)
                        }
                    }(this))
                };
                IframeView.prototype.iframeWidth = function() {
                    if (helpers.isSmallScreen()) {
                        return 328
                    } else {
                        return 380
                    }
                };
                IframeView.prototype.close = function() {
                    if (!!this.rpc.target.window) {
                        return this.rpc.invoke("close")
                    }
                };
                IframeView.prototype.closed = function(e) {
                    var tokenReceived, _base;
                    tokenReceived = this.token != null;
                    document.body.style.overflow = this.originalOverflowValue;
                    this.removeFrame();
                    clearTimeout(this.tokenTimeout);
                    if (tokenReceived) {
                        this.onToken(this.token)
                    }
                    this.token = null;
                    if (typeof(_base = this.options).closed === "function") {
                        _base.closed()
                    }
                    if ((e != null ? e.type : void 0) === "error.close") {
                        return alert(e.message)
                    } else if (!tokenReceived) {
                        return this.preload(this.options)
                    }
                };
                IframeView.prototype.setToken = function(data) {
                    this.token = data;
                    return this.tokenTimeout != null ? this.tokenTimeout : this.tokenTimeout = setTimeout(function(_this) {
                        return function() {
                            _this.onToken(_this.token);
                            _this.tokenTimeout = null;
                            return _this.token = null
                        }
                    }(this), 3e3)
                };
                IframeView.prototype.attachIframe = function() {
                    var cssText, iframe;
                    iframe = document.createElement("iframe");
                    iframe.setAttribute("frameBorder", "0");
                    iframe.setAttribute("allowtransparency", "true");
                    cssText = "z-index: 2147483647;\ndisplay: none;\nbackground: transparent;\nbackground: rgba(0,0,0,0.005);\nborder: 0px none transparent;\noverflow-x: hidden;\noverflow-y: auto;\nvisibility: hidden;\nmargin: 0;\npadding: 0;\n-webkit-tap-highlight-color: transparent;\n-webkit-touch-callout: none;";
                    if (this.shouldShowTouchOverlay()) {
                        cssText += "position: absolute;\nwidth: " + this.iframeWidth() + "px;\nheight: " + document.body.scrollHeight + "px;"
                    } else {
                        cssText += "position: fixed;\nleft: 0;\ntop: 0;\nwidth: 100%;\nheight: 100%;"
                    }
                    iframe.style.cssText = cssText;
                    helpers.bind(iframe, "load", function() {
                        return iframe.style.visibility = "visible"
                    });
                    iframe.src = this.host + this.path;
                    iframe.className = iframe.name = "stripe_checkout_app";
                    utils.append(document.body, iframe);
                    return iframe
                };
                IframeView.prototype.showTouchOverlay = function() {
                    var toRepaint;
                    if (this.overlay) {
                        return
                    }
                    this.overlay = document.createElement("div");
                    this.overlay.style.cssText = "z-index: 2147483646;\nbackground: #000;\nopacity: 0;\nborder: 0px none transparent;\noverflow: none;\nmargin: 0;\npadding: 0;\n-webkit-tap-highlight-color: transparent;\n-webkit-touch-callout: none;\ntransition: opacity 320ms ease;\n-webkit-transition: opacity 320ms ease;\n-moz-transition: opacity 320ms ease;\n-ms-transition: opacity 320ms ease;";
                    this.overlay.style.position = "absolute";
                    this.overlay.style.left = 0;
                    this.overlay.style.top = 0;
                    this.overlay.style.width = document.body.scrollWidth + "px";
                    this.overlay.style.height = document.body.scrollHeight + "px";
                    utils.append(document.body, this.overlay);
                    toRepaint = this.overlay.offsetHeight;
                    return this.overlay.style.opacity = "0.5"
                };
                IframeView.prototype.removeTouchOverlay = function() {
                    var overlay;
                    if (!this.overlay) {
                        return
                    }
                    overlay = this.overlay;
                    overlay.style.opacity = "0";
                    setTimeout(function() {
                        return utils.remove(overlay)
                    }, 400);
                    return this.overlay = null
                };
                IframeView.prototype.removeFrame = function() {
                    var frame;
                    if (this.shouldShowTouchOverlay()) {
                        this.removeTouchOverlay()
                    }
                    frame = this.frame;
                    setTimeout(function() {
                        return utils.remove(frame)
                    }, 500);
                    return this.frame = null
                };
                IframeView.prototype.configure = function() {
                    if (this.frame != null) {
                        this.removeFrame()
                    }
                    this.frame = this.attachIframe();
                    this.rpc = new RPC(this.frame.contentWindow, {
                        host: this.host
                    });
                    this.rpc.methods.closed = this.closed;
                    this.rpc.methods.setToken = this.setToken;
                    return this.rpc.methods.opened = this.opened
                };
                IframeView.prototype.shouldShowTouchOverlay = function() {
                    return helpers.isSupportedMobileOS()
                };
                return IframeView
            }(View);
            module.exports = IframeView
        }).call(this)
    }
});
StripeCheckout.require.define({
    "outer/views/tabView": function(exports, require, module) {
        (function() {
            var RPC, TabView, View, helpers, __bind = function(fn, me) {
                    return function() {
                        return fn.apply(me, arguments)
                    }
                },
                __hasProp = {}.hasOwnProperty,
                __extends = function(child, parent) {
                    for (var key in parent) {
                        if (__hasProp.call(parent, key)) child[key] = parent[key]
                    }

                    function ctor() {
                        this.constructor = child
                    }
                    ctor.prototype = parent.prototype;
                    child.prototype = new ctor;
                    child.__super__ = parent.prototype;
                    return child
                };
            RPC = require("lib/rpc");
            helpers = require("lib/helpers");
            View = require("outer/views/view");
            TabView = function(_super) {
                __extends(TabView, _super);

                function TabView() {
                    this.closed = __bind(this.closed, this);
                    this.checkForClosedTab = __bind(this.checkForClosedTab, this);
                    this.setToken = __bind(this.setToken, this);
                    this.fullPath = __bind(this.fullPath, this);
                    this.close = __bind(this.close, this);
                    this.open = __bind(this.open, this);
                    TabView.__super__.constructor.apply(this, arguments);
                    this.closedTabInterval = null;
                    this.color = null;
                    this.colorSet = false
                }
                TabView.prototype.open = function(options, callback) {
                    var targetName, url, _base, _ref, _ref1;
                    TabView.__super__.open.apply(this, arguments);
                    try {
                        if ((_ref = this.frame) != null) {
                            _ref.close()
                        }
                    } catch (_error) {}
                    if (window.name === "stripe_checkout_tabview") {
                        window.name = ""
                    }
                    if (helpers.isiOSChrome()) {
                        targetName = "_blank"
                    } else {
                        targetName = "stripe_checkout_tabview"
                    }
                    this.frame = window.open(this.fullPath(), targetName);
                    if (!this.frame && ((_ref1 = this.options.key) != null ? _ref1.indexOf("test") : void 0) !== -1) {
                        url = "https://stripe.com/docs/checkout#integration-more-runloop";
                        console.error("Stripe Checkout was unable to open a new window, possibly due to a popup blocker.\nTo provide the best experience for your users, follow the guide at " + url + ".\nThis message will only appear when using a test publishable key.")
                    }
                    if (!this.frame || this.frame === window) {
                        this.close();
                        callback(false);
                        return
                    }
                    if (typeof(_base = this.frame).focus === "function") {
                        _base.focus()
                    }
                    this.rpc = new RPC(this.frame, {
                        host: this.host
                    });
                    this.rpc.methods.setToken = this.setToken;
                    this.rpc.methods.closed = this.closed;
                    return this.rpc.ready(function(_this) {
                        return function() {
                            var _base1;
                            callback(true);
                            _this.rpc.invoke("render", "", "tab", _this.options);
                            _this.rpc.invoke("open");
                            if (typeof(_base1 = _this.options).opened === "function") {
                                _base1.opened()
                            }
                            return _this.checkForClosedTab()
                        }
                    }(this))
                };
                TabView.prototype.close = function() {
                    if (this.frame && this.frame !== window) {
                        return this.frame.close()
                    }
                };
                TabView.prototype.fullPath = function() {
                    return this.host + this.path
                };
                TabView.prototype.setToken = function(data) {
                    this.token = data;
                    return this.tokenTimeout != null ? this.tokenTimeout : this.tokenTimeout = setTimeout(function(_this) {
                        return function() {
                            _this.onToken(_this.token);
                            _this.tokenTimeout = null;
                            return _this.token = null
                        }
                    }(this), 3e3)
                };
                TabView.prototype.checkForClosedTab = function() {
                    if (this.closedTabInterval) {
                        clearInterval(this.closedTabInterval)
                    }
                    return this.closedTabInterval = setInterval(function(_this) {
                        return function() {
                            if (!_this.frame || !_this.frame.postMessage || _this.frame.closed) {
                                return _this.closed()
                            }
                        }
                    }(this), 100)
                };
                TabView.prototype.closed = function() {
                    var _base;
                    clearInterval(this.closedTabInterval);
                    clearTimeout(this.tokenTimeout);
                    if (this.token != null) {
                        this.onToken(this.token)
                    }
                    return typeof(_base = this.options).closed === "function" ? _base.closed() : void 0
                };
                return TabView
            }(View);
            module.exports = TabView
        }).call(this)
    }
});
StripeCheckout.require.define({
    "outer/views/view": function(exports, require, module) {
        (function() {
            var View, __bind = function(fn, me) {
                    return function() {
                        return fn.apply(me, arguments)
                    }
                },
                __slice = [].slice;
            View = function() {
                function View(onToken, host, path) {
                    this.triggerTokenCallback = __bind(this.triggerTokenCallback, this);
                    this.open = __bind(this.open, this);
                    this.onToken = onToken;
                    this.host = host;
                    this.path = path
                }
                View.prototype.open = function(options, callback) {
                    return this.options = options
                };
                View.prototype.close = function() {};
                View.prototype.preload = function(options) {};
                View.prototype.triggerTokenCallback = function() {
                    var args;
                    args = arguments;
                    return this.rpc.ready(function(_this) {
                        return function() {
                            var _ref;
                            return (_ref = _this.rpc).invoke.apply(_ref, ["tokenCallback"].concat(__slice.call(args)))
                        }
                    }(this))
                };
                return View
            }();
            module.exports = View
        }).call(this)
    }
});
(function() {
    var App, Button, app, require, _ref, _ref1, _ref2, _ref3, _ref4;
    require = require || this.StripeCheckout.require;
    Button = require("outer/controllers/button");
    App = require("outer/controllers/app");
    if (((_ref = this.StripeCheckout) != null ? _ref.__app : void 0) == null) {
        this.StripeCheckout || (this.StripeCheckout = {});
        this.StripeCheckout.__app = app = new App;
        this.StripeCheckout.open = app.open;
        this.StripeCheckout.configure = app.configure;
        this.StripeButton = this.StripeCheckout;
        if (((_ref1 = this.StripeCheckout) != null ? _ref1.__forceManhattan : void 0) != null) {
            app.setForceManhattan(this.StripeCheckout.__forceManhattan)
        }
        if (((_ref2 = this.StripeCheckout) != null ? _ref2.__forceView : void 0) != null) {
            app.setForceView(this.StripeCheckout.__forceView)
        }
        if (((_ref3 = this.StripeCheckout) != null ? _ref3.__forceAppType : void 0) != null) {
            app.setForceAppType(this.StripeCheckout.__forceAppType)
        }
        if (((_ref4 = this.StripeCheckout) != null ? _ref4.__host : void 0) && this.StripeCheckout.__host !== "") {
            app.setHost(this.StripeCheckout.__host)
        }
    }
    Button.load(this.StripeCheckout.__app)
}).call(this);
//# sourceMappingURL=https://sourcemaps.corp.stripe.com/checkout/checkout.js.map