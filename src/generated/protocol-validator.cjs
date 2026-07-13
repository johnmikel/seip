"use strict";
var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};

// node_modules/ajv/dist/runtime/ucs2length.js
var require_ucs2length = __commonJS({
  "node_modules/ajv/dist/runtime/ucs2length.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    function ucs2length(str) {
      const len = str.length;
      let length = 0;
      let pos = 0;
      let value;
      while (pos < len) {
        length++;
        value = str.charCodeAt(pos++);
        if (value >= 55296 && value <= 56319 && pos < len) {
          value = str.charCodeAt(pos);
          if ((value & 64512) === 56320)
            pos++;
        }
      }
      return length;
    }
    exports2.default = ucs2length;
    ucs2length.code = 'require("ajv/dist/runtime/ucs2length").default';
  }
});

// node_modules/fast-deep-equal/index.js
var require_fast_deep_equal = __commonJS({
  "node_modules/fast-deep-equal/index.js"(exports2, module2) {
    "use strict";
    module2.exports = function equal(a, b) {
      if (a === b) return true;
      if (a && b && typeof a == "object" && typeof b == "object") {
        if (a.constructor !== b.constructor) return false;
        var length, i, keys;
        if (Array.isArray(a)) {
          length = a.length;
          if (length != b.length) return false;
          for (i = length; i-- !== 0; )
            if (!equal(a[i], b[i])) return false;
          return true;
        }
        if (a.constructor === RegExp) return a.source === b.source && a.flags === b.flags;
        if (a.valueOf !== Object.prototype.valueOf) return a.valueOf() === b.valueOf();
        if (a.toString !== Object.prototype.toString) return a.toString() === b.toString();
        keys = Object.keys(a);
        length = keys.length;
        if (length !== Object.keys(b).length) return false;
        for (i = length; i-- !== 0; )
          if (!Object.prototype.hasOwnProperty.call(b, keys[i])) return false;
        for (i = length; i-- !== 0; ) {
          var key = keys[i];
          if (!equal(a[key], b[key])) return false;
        }
        return true;
      }
      return a !== a && b !== b;
    };
  }
});

// node_modules/ajv/dist/runtime/equal.js
var require_equal = __commonJS({
  "node_modules/ajv/dist/runtime/equal.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    var equal = require_fast_deep_equal();
    equal.code = 'require("ajv/dist/runtime/equal").default';
    exports2.default = equal;
  }
});

// node_modules/ajv-formats/dist/formats.js
var require_formats = __commonJS({
  "node_modules/ajv-formats/dist/formats.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.formatNames = exports2.fastFormats = exports2.fullFormats = void 0;
    function fmtDef(validate, compare) {
      return { validate, compare };
    }
    exports2.fullFormats = {
      // date: http://tools.ietf.org/html/rfc3339#section-5.6
      date: fmtDef(date, compareDate),
      // date-time: http://tools.ietf.org/html/rfc3339#section-5.6
      time: fmtDef(getTime(true), compareTime),
      "date-time": fmtDef(getDateTime(true), compareDateTime),
      "iso-time": fmtDef(getTime(), compareIsoTime),
      "iso-date-time": fmtDef(getDateTime(), compareIsoDateTime),
      // duration: https://tools.ietf.org/html/rfc3339#appendix-A
      duration: /^P(?!$)((\d+Y)?(\d+M)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+S)?)?|(\d+W)?)$/,
      uri,
      "uri-reference": /^(?:[a-z][a-z0-9+\-.]*:)?(?:\/?\/(?:(?:[a-z0-9\-._~!$&'()*+,;=:]|%[0-9a-f]{2})*@)?(?:\[(?:(?:(?:(?:[0-9a-f]{1,4}:){6}|::(?:[0-9a-f]{1,4}:){5}|(?:[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){4}|(?:(?:[0-9a-f]{1,4}:){0,1}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){3}|(?:(?:[0-9a-f]{1,4}:){0,2}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){2}|(?:(?:[0-9a-f]{1,4}:){0,3}[0-9a-f]{1,4})?::[0-9a-f]{1,4}:|(?:(?:[0-9a-f]{1,4}:){0,4}[0-9a-f]{1,4})?::)(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?))|(?:(?:[0-9a-f]{1,4}:){0,5}[0-9a-f]{1,4})?::[0-9a-f]{1,4}|(?:(?:[0-9a-f]{1,4}:){0,6}[0-9a-f]{1,4})?::)|[Vv][0-9a-f]+\.[a-z0-9\-._~!$&'()*+,;=:]+)\]|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)|(?:[a-z0-9\-._~!$&'"()*+,;=]|%[0-9a-f]{2})*)(?::\d*)?(?:\/(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})*)*|\/(?:(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})*)*)?|(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})*)*)?(?:\?(?:[a-z0-9\-._~!$&'"()*+,;=:@/?]|%[0-9a-f]{2})*)?(?:#(?:[a-z0-9\-._~!$&'"()*+,;=:@/?]|%[0-9a-f]{2})*)?$/i,
      // uri-template: https://tools.ietf.org/html/rfc6570
      "uri-template": /^(?:(?:[^\x00-\x20"'<>%\\^`{|}]|%[0-9a-f]{2})|\{[+#./;?&=,!@|]?(?:[a-z0-9_]|%[0-9a-f]{2})+(?::[1-9][0-9]{0,3}|\*)?(?:,(?:[a-z0-9_]|%[0-9a-f]{2})+(?::[1-9][0-9]{0,3}|\*)?)*\})*$/i,
      // For the source: https://gist.github.com/dperini/729294
      // For test cases: https://mathiasbynens.be/demo/url-regex
      url: /^(?:https?|ftp):\/\/(?:\S+(?::\S*)?@)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z0-9\u{00a1}-\u{ffff}]+-)*[a-z0-9\u{00a1}-\u{ffff}]+)(?:\.(?:[a-z0-9\u{00a1}-\u{ffff}]+-)*[a-z0-9\u{00a1}-\u{ffff}]+)*(?:\.(?:[a-z\u{00a1}-\u{ffff}]{2,})))(?::\d{2,5})?(?:\/[^\s]*)?$/iu,
      email: /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i,
      hostname: /^(?=.{1,253}\.?$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[-0-9a-z]{0,61}[0-9a-z])?)*\.?$/i,
      // optimized https://www.safaribooksonline.com/library/view/regular-expressions-cookbook/9780596802837/ch07s16.html
      ipv4: /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/,
      ipv6: /^((([0-9a-f]{1,4}:){7}([0-9a-f]{1,4}|:))|(([0-9a-f]{1,4}:){6}(:[0-9a-f]{1,4}|((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9a-f]{1,4}:){5}(((:[0-9a-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9a-f]{1,4}:){4}(((:[0-9a-f]{1,4}){1,3})|((:[0-9a-f]{1,4})?:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9a-f]{1,4}:){3}(((:[0-9a-f]{1,4}){1,4})|((:[0-9a-f]{1,4}){0,2}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9a-f]{1,4}:){2}(((:[0-9a-f]{1,4}){1,5})|((:[0-9a-f]{1,4}){0,3}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9a-f]{1,4}:){1}(((:[0-9a-f]{1,4}){1,6})|((:[0-9a-f]{1,4}){0,4}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(:(((:[0-9a-f]{1,4}){1,7})|((:[0-9a-f]{1,4}){0,5}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))$/i,
      regex,
      // uuid: http://tools.ietf.org/html/rfc4122
      uuid: /^(?:urn:uuid:)?[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i,
      // JSON-pointer: https://tools.ietf.org/html/rfc6901
      // uri fragment: https://tools.ietf.org/html/rfc3986#appendix-A
      "json-pointer": /^(?:\/(?:[^~/]|~0|~1)*)*$/,
      "json-pointer-uri-fragment": /^#(?:\/(?:[a-z0-9_\-.!$&'()*+,;:=@]|%[0-9a-f]{2}|~0|~1)*)*$/i,
      // relative JSON-pointer: http://tools.ietf.org/html/draft-luff-relative-json-pointer-00
      "relative-json-pointer": /^(?:0|[1-9][0-9]*)(?:#|(?:\/(?:[^~/]|~0|~1)*)*)$/,
      // the following formats are used by the openapi specification: https://spec.openapis.org/oas/v3.0.0#data-types
      // byte: https://github.com/miguelmota/is-base64
      byte,
      // signed 32 bit integer
      int32: { type: "number", validate: validateInt32 },
      // signed 64 bit integer
      int64: { type: "number", validate: validateInt64 },
      // C-type float
      float: { type: "number", validate: validateNumber },
      // C-type double
      double: { type: "number", validate: validateNumber },
      // hint to the UI to hide input strings
      password: true,
      // unchecked string payload
      binary: true
    };
    exports2.fastFormats = {
      ...exports2.fullFormats,
      date: fmtDef(/^\d\d\d\d-[0-1]\d-[0-3]\d$/, compareDate),
      time: fmtDef(/^(?:[0-2]\d:[0-5]\d:[0-5]\d|23:59:60)(?:\.\d+)?(?:z|[+-]\d\d(?::?\d\d)?)$/i, compareTime),
      "date-time": fmtDef(/^\d\d\d\d-[0-1]\d-[0-3]\dt(?:[0-2]\d:[0-5]\d:[0-5]\d|23:59:60)(?:\.\d+)?(?:z|[+-]\d\d(?::?\d\d)?)$/i, compareDateTime),
      "iso-time": fmtDef(/^(?:[0-2]\d:[0-5]\d:[0-5]\d|23:59:60)(?:\.\d+)?(?:z|[+-]\d\d(?::?\d\d)?)?$/i, compareIsoTime),
      "iso-date-time": fmtDef(/^\d\d\d\d-[0-1]\d-[0-3]\d[t\s](?:[0-2]\d:[0-5]\d:[0-5]\d|23:59:60)(?:\.\d+)?(?:z|[+-]\d\d(?::?\d\d)?)?$/i, compareIsoDateTime),
      // uri: https://github.com/mafintosh/is-my-json-valid/blob/master/formats.js
      uri: /^(?:[a-z][a-z0-9+\-.]*:)(?:\/?\/)?[^\s]*$/i,
      "uri-reference": /^(?:(?:[a-z][a-z0-9+\-.]*:)?\/?\/)?(?:[^\\\s#][^\s#]*)?(?:#[^\\\s]*)?$/i,
      // email (sources from jsen validator):
      // http://stackoverflow.com/questions/201323/using-a-regular-expression-to-validate-an-email-address#answer-8829363
      // http://www.w3.org/TR/html5/forms.html#valid-e-mail-address (search for 'wilful violation')
      email: /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/i
    };
    exports2.formatNames = Object.keys(exports2.fullFormats);
    function isLeapYear(year) {
      return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    }
    var DATE = /^(\d\d\d\d)-(\d\d)-(\d\d)$/;
    var DAYS = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    function date(str) {
      const matches = DATE.exec(str);
      if (!matches)
        return false;
      const year = +matches[1];
      const month = +matches[2];
      const day = +matches[3];
      return month >= 1 && month <= 12 && day >= 1 && day <= (month === 2 && isLeapYear(year) ? 29 : DAYS[month]);
    }
    function compareDate(d1, d2) {
      if (!(d1 && d2))
        return void 0;
      if (d1 > d2)
        return 1;
      if (d1 < d2)
        return -1;
      return 0;
    }
    var TIME = /^(\d\d):(\d\d):(\d\d(?:\.\d+)?)(z|([+-])(\d\d)(?::?(\d\d))?)?$/i;
    function getTime(strictTimeZone) {
      return function time(str) {
        const matches = TIME.exec(str);
        if (!matches)
          return false;
        const hr = +matches[1];
        const min = +matches[2];
        const sec = +matches[3];
        const tz = matches[4];
        const tzSign = matches[5] === "-" ? -1 : 1;
        const tzH = +(matches[6] || 0);
        const tzM = +(matches[7] || 0);
        if (tzH > 23 || tzM > 59 || strictTimeZone && !tz)
          return false;
        if (hr <= 23 && min <= 59 && sec < 60)
          return true;
        const utcMin = min - tzM * tzSign;
        const utcHr = hr - tzH * tzSign - (utcMin < 0 ? 1 : 0);
        return (utcHr === 23 || utcHr === -1) && (utcMin === 59 || utcMin === -1) && sec < 61;
      };
    }
    function compareTime(s1, s2) {
      if (!(s1 && s2))
        return void 0;
      const t1 = (/* @__PURE__ */ new Date("2020-01-01T" + s1)).valueOf();
      const t2 = (/* @__PURE__ */ new Date("2020-01-01T" + s2)).valueOf();
      if (!(t1 && t2))
        return void 0;
      return t1 - t2;
    }
    function compareIsoTime(t1, t2) {
      if (!(t1 && t2))
        return void 0;
      const a1 = TIME.exec(t1);
      const a2 = TIME.exec(t2);
      if (!(a1 && a2))
        return void 0;
      t1 = a1[1] + a1[2] + a1[3];
      t2 = a2[1] + a2[2] + a2[3];
      if (t1 > t2)
        return 1;
      if (t1 < t2)
        return -1;
      return 0;
    }
    var DATE_TIME_SEPARATOR = /t|\s/i;
    function getDateTime(strictTimeZone) {
      const time = getTime(strictTimeZone);
      return function date_time(str) {
        const dateTime = str.split(DATE_TIME_SEPARATOR);
        return dateTime.length === 2 && date(dateTime[0]) && time(dateTime[1]);
      };
    }
    function compareDateTime(dt1, dt2) {
      if (!(dt1 && dt2))
        return void 0;
      const d1 = new Date(dt1).valueOf();
      const d2 = new Date(dt2).valueOf();
      if (!(d1 && d2))
        return void 0;
      return d1 - d2;
    }
    function compareIsoDateTime(dt1, dt2) {
      if (!(dt1 && dt2))
        return void 0;
      const [d1, t1] = dt1.split(DATE_TIME_SEPARATOR);
      const [d2, t2] = dt2.split(DATE_TIME_SEPARATOR);
      const res = compareDate(d1, d2);
      if (res === void 0)
        return void 0;
      return res || compareTime(t1, t2);
    }
    var NOT_URI_FRAGMENT = /\/|:/;
    var URI = /^(?:[a-z][a-z0-9+\-.]*:)(?:\/?\/(?:(?:[a-z0-9\-._~!$&'()*+,;=:]|%[0-9a-f]{2})*@)?(?:\[(?:(?:(?:(?:[0-9a-f]{1,4}:){6}|::(?:[0-9a-f]{1,4}:){5}|(?:[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){4}|(?:(?:[0-9a-f]{1,4}:){0,1}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){3}|(?:(?:[0-9a-f]{1,4}:){0,2}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){2}|(?:(?:[0-9a-f]{1,4}:){0,3}[0-9a-f]{1,4})?::[0-9a-f]{1,4}:|(?:(?:[0-9a-f]{1,4}:){0,4}[0-9a-f]{1,4})?::)(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?))|(?:(?:[0-9a-f]{1,4}:){0,5}[0-9a-f]{1,4})?::[0-9a-f]{1,4}|(?:(?:[0-9a-f]{1,4}:){0,6}[0-9a-f]{1,4})?::)|[Vv][0-9a-f]+\.[a-z0-9\-._~!$&'()*+,;=:]+)\]|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)|(?:[a-z0-9\-._~!$&'()*+,;=]|%[0-9a-f]{2})*)(?::\d*)?(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*|\/(?:(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*)?|(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*)(?:\?(?:[a-z0-9\-._~!$&'()*+,;=:@/?]|%[0-9a-f]{2})*)?(?:#(?:[a-z0-9\-._~!$&'()*+,;=:@/?]|%[0-9a-f]{2})*)?$/i;
    function uri(str) {
      return NOT_URI_FRAGMENT.test(str) && URI.test(str);
    }
    var BYTE = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/gm;
    function byte(str) {
      BYTE.lastIndex = 0;
      return BYTE.test(str);
    }
    var MIN_INT32 = -(2 ** 31);
    var MAX_INT32 = 2 ** 31 - 1;
    function validateInt32(value) {
      return Number.isInteger(value) && value <= MAX_INT32 && value >= MIN_INT32;
    }
    function validateInt64(value) {
      return Number.isInteger(value);
    }
    function validateNumber() {
      return true;
    }
    var Z_ANCHOR = /[^\\]\\Z/;
    function regex(str) {
      if (Z_ANCHOR.test(str))
        return false;
      try {
        new RegExp(str);
        return true;
      } catch (e) {
        return false;
      }
    }
  }
});

// protocol-validator.raw.cjs
module.exports = validate20;
module.exports.default = validate20;
var schema36 = { "title": "Declaration Status", "type": "string", "enum": ["DRAFT", "PROPOSED", "UNDER_REVIEW", "ACCEPTED", "ENFORCING", "COMPLETED", "WITHDRAWN", "REJECTED"] };
var func0 = Object.prototype.hasOwnProperty;
var func74 = require_ucs2length().default;
var func27 = require_equal().default;
var pattern4 = new RegExp("^(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)(?:-((?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)(?:\\.(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\\+([0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*))?$", "u");
var pattern5 = new RegExp("^[A-Za-z0-9](?!.*\\.\\.)[A-Za-z0-9_.-]*$", "u");
var pattern6 = new RegExp("^[0-9]{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01])[Tt](?:[01][0-9]|2[0-3]):[0-5][0-9]:(?:[0-5][0-9]|60)(?:\\.[0-9]+)?(?:[Zz]|[+-](?:[01][0-9]|2[0-3]):[0-5][0-9])(?![\\s\\S])", "u");
var formats0 = require_formats().fullFormats["date-time"];
var pattern7 = new RegExp("^(?!\\s)[\\s\\S]*\\S(?![\\s\\S])", "u");
function validate21(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate21.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.team === void 0 || !func0.call(data, "team")) {
      const err0 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "team" }, message: "must have required property 'team'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.team !== void 0 && func0.call(data, "team")) {
      let data0 = data.team;
      if (typeof data0 === "string") {
        if (func74(data0) > 128) {
          const err1 = { instancePath: instancePath + "/team", schemaPath: "#/$defs/TeamId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" };
          if (vErrors === null) {
            vErrors = [err1];
          } else {
            vErrors.push(err1);
          }
          errors++;
        }
        if (func74(data0) < 1) {
          const err2 = { instancePath: instancePath + "/team", schemaPath: "#/$defs/TeamId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err2];
          } else {
            vErrors.push(err2);
          }
          errors++;
        }
        if (!pattern7.test(data0)) {
          const err3 = { instancePath: instancePath + "/team", schemaPath: "#/$defs/TeamId/pattern", keyword: "pattern", params: { pattern: "^(?!\\s)[\\s\\S]*\\S(?![\\s\\S])" }, message: 'must match pattern "^(?!\\s)[\\s\\S]*\\S(?![\\s\\S])"' };
          if (vErrors === null) {
            vErrors = [err3];
          } else {
            vErrors.push(err3);
          }
          errors++;
        }
      } else {
        const err4 = { instancePath: instancePath + "/team", schemaPath: "#/$defs/TeamId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.contact !== void 0 && func0.call(data, "contact")) {
      if (typeof data.contact !== "string") {
        const err5 = { instancePath: instancePath + "/contact", schemaPath: "#/properties/contact/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
  } else {
    const err6 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err6];
    } else {
      vErrors.push(err6);
    }
    errors++;
  }
  validate21.errors = vErrors;
  return errors === 0;
}
validate21.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var schema40 = { "title": "Add Change", "allOf": [{ "$ref": "#/$defs/NormalizedChangeCore" }, { "type": "object", "required": ["kind", "after"], "properties": { "kind": { "enum": ["object_add", "add"] }, "after": { "$ref": "#/$defs/SnapshotValue" }, "before": false } }] };
var schema41 = { "title": "Normalized Change Core", "type": "object", "additionalProperties": true, "required": ["change_id", "fingerprint_version", "schema_kind", "target", "kind", "compatibility"], "properties": { "change_id": { "$ref": "#/$defs/ChangeId" }, "fingerprint_version": { "const": 1 }, "schema_kind": { "$ref": "#/$defs/NonEmptyString" }, "target": { "$ref": "#/$defs/Target" }, "kind": { "$ref": "#/$defs/ChangeKind" }, "compatibility": { "type": "string", "enum": ["compatible", "breaking", "unknown"] }, "before": { "$ref": "#/$defs/SnapshotValue" }, "after": { "$ref": "#/$defs/SnapshotValue" } } };
var schema50 = { "title": "Change Kind", "oneOf": [{ "type": "string", "enum": ["object_add", "add", "object_remove", "remove", "rename", "retype", "make_required", "make_optional", "make_non_nullable", "make_nullable", "enum_narrow", "enum_widen", "format_change", "constraint_change", "deprecate", "unknown"] }, { "type": "string", "pattern": "^[^:]+:.+$" }] };
var pattern8 = new RegExp("^chg_sha256_[0-9a-f]{64}$", "u");
var pattern9 = new RegExp("^[^:]+:.+$", "u");
function validate27(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate27.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  const _errs0 = errors;
  let valid0 = false;
  let passing0 = null;
  const _errs1 = errors;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.type === void 0 || !func0.call(data, "type")) {
      const err0 = { instancePath, schemaPath: "#/$defs/PathProperty/required", keyword: "required", params: { missingProperty: "type" }, message: "must have required property 'type'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.name === void 0 || !func0.call(data, "name")) {
      const err1 = { instancePath, schemaPath: "#/$defs/PathProperty/required", keyword: "required", params: { missingProperty: "name" }, message: "must have required property 'name'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    for (const key0 of Object.keys(data)) {
      if (!(key0 === "type" || key0 === "name")) {
        const err2 = { instancePath, schemaPath: "#/$defs/PathProperty/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    if (data.type !== void 0 && func0.call(data, "type")) {
      if ("property" !== data.type) {
        const err3 = { instancePath: instancePath + "/type", schemaPath: "#/$defs/PathProperty/properties/type/const", keyword: "const", params: { allowedValue: "property" }, message: "must be equal to constant" };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
    if (data.name !== void 0 && func0.call(data, "name")) {
      if (typeof data.name !== "string") {
        const err4 = { instancePath: instancePath + "/name", schemaPath: "#/$defs/PathProperty/properties/name/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
  } else {
    const err5 = { instancePath, schemaPath: "#/$defs/PathProperty/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err5];
    } else {
      vErrors.push(err5);
    }
    errors++;
  }
  var _valid0 = _errs1 === errors;
  if (_valid0) {
    valid0 = true;
    passing0 = 0;
    var props0 = true;
  }
  const _errs8 = errors;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.type === void 0 || !func0.call(data, "type")) {
      const err6 = { instancePath, schemaPath: "#/$defs/PathItems/required", keyword: "required", params: { missingProperty: "type" }, message: "must have required property 'type'" };
      if (vErrors === null) {
        vErrors = [err6];
      } else {
        vErrors.push(err6);
      }
      errors++;
    }
    for (const key1 of Object.keys(data)) {
      if (!(key1 === "type")) {
        const err7 = { instancePath, schemaPath: "#/$defs/PathItems/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
    }
    if (data.type !== void 0 && func0.call(data, "type")) {
      if ("items" !== data.type) {
        const err8 = { instancePath: instancePath + "/type", schemaPath: "#/$defs/PathItems/properties/type/const", keyword: "const", params: { allowedValue: "items" }, message: "must be equal to constant" };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      }
    }
  } else {
    const err9 = { instancePath, schemaPath: "#/$defs/PathItems/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err9];
    } else {
      vErrors.push(err9);
    }
    errors++;
  }
  var _valid0 = _errs8 === errors;
  if (_valid0 && valid0) {
    valid0 = false;
    passing0 = [passing0, 1];
  } else {
    if (_valid0) {
      valid0 = true;
      passing0 = 1;
      if (props0 !== true) {
        props0 = true;
      }
    }
    const _errs13 = errors;
    if (data && typeof data == "object" && !Array.isArray(data)) {
      if (data.type === void 0 || !func0.call(data, "type")) {
        const err10 = { instancePath, schemaPath: "#/$defs/PathTupleItem/required", keyword: "required", params: { missingProperty: "type" }, message: "must have required property 'type'" };
        if (vErrors === null) {
          vErrors = [err10];
        } else {
          vErrors.push(err10);
        }
        errors++;
      }
      if (data.index === void 0 || !func0.call(data, "index")) {
        const err11 = { instancePath, schemaPath: "#/$defs/PathTupleItem/required", keyword: "required", params: { missingProperty: "index" }, message: "must have required property 'index'" };
        if (vErrors === null) {
          vErrors = [err11];
        } else {
          vErrors.push(err11);
        }
        errors++;
      }
      for (const key2 of Object.keys(data)) {
        if (!(key2 === "type" || key2 === "index")) {
          const err12 = { instancePath, schemaPath: "#/$defs/PathTupleItem/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key2 }, message: "must NOT have additional properties" };
          if (vErrors === null) {
            vErrors = [err12];
          } else {
            vErrors.push(err12);
          }
          errors++;
        }
      }
      if (data.type !== void 0 && func0.call(data, "type")) {
        if ("tuple_item" !== data.type) {
          const err13 = { instancePath: instancePath + "/type", schemaPath: "#/$defs/PathTupleItem/properties/type/const", keyword: "const", params: { allowedValue: "tuple_item" }, message: "must be equal to constant" };
          if (vErrors === null) {
            vErrors = [err13];
          } else {
            vErrors.push(err13);
          }
          errors++;
        }
      }
      if (data.index !== void 0 && func0.call(data, "index")) {
        let data4 = data.index;
        if (!(typeof data4 == "number" && (!(data4 % 1) && !isNaN(data4)) && isFinite(data4))) {
          const err14 = { instancePath: instancePath + "/index", schemaPath: "#/$defs/PathTupleItem/properties/index/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
          if (vErrors === null) {
            vErrors = [err14];
          } else {
            vErrors.push(err14);
          }
          errors++;
        }
        if (typeof data4 == "number" && isFinite(data4)) {
          if (data4 > 9007199254740991 || isNaN(data4)) {
            const err15 = { instancePath: instancePath + "/index", schemaPath: "#/$defs/PathTupleItem/properties/index/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" };
            if (vErrors === null) {
              vErrors = [err15];
            } else {
              vErrors.push(err15);
            }
            errors++;
          }
          if (data4 < 0 || isNaN(data4)) {
            const err16 = { instancePath: instancePath + "/index", schemaPath: "#/$defs/PathTupleItem/properties/index/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
            if (vErrors === null) {
              vErrors = [err16];
            } else {
              vErrors.push(err16);
            }
            errors++;
          }
        }
      }
    } else {
      const err17 = { instancePath, schemaPath: "#/$defs/PathTupleItem/type", keyword: "type", params: { type: "object" }, message: "must be object" };
      if (vErrors === null) {
        vErrors = [err17];
      } else {
        vErrors.push(err17);
      }
      errors++;
    }
    var _valid0 = _errs13 === errors;
    if (_valid0 && valid0) {
      valid0 = false;
      passing0 = [passing0, 2];
    } else {
      if (_valid0) {
        valid0 = true;
        passing0 = 2;
        if (props0 !== true) {
          props0 = true;
        }
      }
    }
  }
  if (!valid0) {
    const err18 = { instancePath, schemaPath: "#/oneOf", keyword: "oneOf", params: { passingSchemas: passing0 }, message: "must match exactly one schema in oneOf" };
    if (vErrors === null) {
      vErrors = [err18];
    } else {
      vErrors.push(err18);
    }
    errors++;
  } else {
    errors = _errs0;
    if (vErrors !== null) {
      if (_errs0) {
        vErrors.length = _errs0;
      } else {
        vErrors = null;
      }
    }
  }
  validate27.errors = vErrors;
  evaluated0.props = props0;
  return errors === 0;
}
validate27.evaluated = { "dynamicProps": true, "dynamicItems": false };
function validate26(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate26.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.object === void 0 || !func0.call(data, "object")) {
      const err0 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "object" }, message: "must have required property 'object'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.path === void 0 || !func0.call(data, "path")) {
      const err1 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "path" }, message: "must have required property 'path'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.object !== void 0 && func0.call(data, "object")) {
      let data0 = data.object;
      if (typeof data0 === "string") {
        if (func74(data0) < 1) {
          const err2 = { instancePath: instancePath + "/object", schemaPath: "#/$defs/NonEmptyString/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err2];
          } else {
            vErrors.push(err2);
          }
          errors++;
        }
      } else {
        const err3 = { instancePath: instancePath + "/object", schemaPath: "#/$defs/NonEmptyString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
    if (data.path !== void 0 && func0.call(data, "path")) {
      let data1 = data.path;
      if (Array.isArray(data1)) {
        const len0 = data1.length;
        for (let i0 = 0; i0 < len0; i0++) {
          if (!validate27(data1[i0], { instancePath: instancePath + "/path/" + i0, parentData: data1, parentDataProperty: i0, rootData, dynamicAnchors })) {
            vErrors = vErrors === null ? validate27.errors : vErrors.concat(validate27.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err4 = { instancePath: instancePath + "/path", schemaPath: "#/properties/path/type", keyword: "type", params: { type: "array" }, message: "must be array" };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
  } else {
    const err5 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err5];
    } else {
      vErrors.push(err5);
    }
    errors++;
  }
  validate26.errors = vErrors;
  return errors === 0;
}
validate26.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var pattern10 = new RegExp("^(?:0e0|-?[1-9](?:[0-9]*[1-9])?e-?(?:0|[1-9][0-9]*))$", "u");
var wrapper0 = { validate: validate31 };
function validate32(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate32.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.kind === void 0 || !func0.call(data, "kind")) {
      const err0 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "kind" }, message: "must have required property 'kind'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.items === void 0 || !func0.call(data, "items")) {
      const err1 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "items" }, message: "must have required property 'items'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    for (const key0 of Object.keys(data)) {
      if (!(key0 === "kind" || key0 === "items")) {
        const err2 = { instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    if (data.kind !== void 0 && func0.call(data, "kind")) {
      if ("array" !== data.kind) {
        const err3 = { instancePath: instancePath + "/kind", schemaPath: "#/properties/kind/const", keyword: "const", params: { allowedValue: "array" }, message: "must be equal to constant" };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
    if (data.items !== void 0 && func0.call(data, "items")) {
      let data1 = data.items;
      if (Array.isArray(data1)) {
        const len0 = data1.length;
        for (let i0 = 0; i0 < len0; i0++) {
          if (!wrapper0.validate(data1[i0], { instancePath: instancePath + "/items/" + i0, parentData: data1, parentDataProperty: i0, rootData, dynamicAnchors })) {
            vErrors = vErrors === null ? wrapper0.validate.errors : vErrors.concat(wrapper0.validate.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err4 = { instancePath: instancePath + "/items", schemaPath: "#/properties/items/type", keyword: "type", params: { type: "array" }, message: "must be array" };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
  } else {
    const err5 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err5];
    } else {
      vErrors.push(err5);
    }
    errors++;
  }
  validate32.errors = vErrors;
  return errors === 0;
}
validate32.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
function validate35(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate35.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.key === void 0 || !func0.call(data, "key")) {
      const err0 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "key" }, message: "must have required property 'key'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.value === void 0 || !func0.call(data, "value")) {
      const err1 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "value" }, message: "must have required property 'value'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    for (const key0 of Object.keys(data)) {
      if (!(key0 === "key" || key0 === "value")) {
        const err2 = { instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    if (data.key !== void 0 && func0.call(data, "key")) {
      if (typeof data.key !== "string") {
        const err3 = { instancePath: instancePath + "/key", schemaPath: "#/properties/key/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
    if (data.value !== void 0 && func0.call(data, "value")) {
      if (!wrapper0.validate(data.value, { instancePath: instancePath + "/value", parentData: data, parentDataProperty: "value", rootData, dynamicAnchors })) {
        vErrors = vErrors === null ? wrapper0.validate.errors : vErrors.concat(wrapper0.validate.errors);
        errors = vErrors.length;
      }
    }
  } else {
    const err4 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err4];
    } else {
      vErrors.push(err4);
    }
    errors++;
  }
  validate35.errors = vErrors;
  return errors === 0;
}
validate35.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
function validate34(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate34.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.kind === void 0 || !func0.call(data, "kind")) {
      const err0 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "kind" }, message: "must have required property 'kind'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.entries === void 0 || !func0.call(data, "entries")) {
      const err1 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "entries" }, message: "must have required property 'entries'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    for (const key0 of Object.keys(data)) {
      if (!(key0 === "kind" || key0 === "entries")) {
        const err2 = { instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    if (data.kind !== void 0 && func0.call(data, "kind")) {
      if ("object" !== data.kind) {
        const err3 = { instancePath: instancePath + "/kind", schemaPath: "#/properties/kind/const", keyword: "const", params: { allowedValue: "object" }, message: "must be equal to constant" };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
    if (data.entries !== void 0 && func0.call(data, "entries")) {
      let data1 = data.entries;
      if (Array.isArray(data1)) {
        const len0 = data1.length;
        for (let i0 = 0; i0 < len0; i0++) {
          if (!validate35(data1[i0], { instancePath: instancePath + "/entries/" + i0, parentData: data1, parentDataProperty: i0, rootData, dynamicAnchors })) {
            vErrors = vErrors === null ? validate35.errors : vErrors.concat(validate35.errors);
            errors = vErrors.length;
          }
        }
        let i1 = data1.length;
        let j0;
        if (i1 > 1) {
          outer0: for (; i1--; ) {
            for (j0 = i1; j0--; ) {
              if (func27(data1[i1], data1[j0])) {
                const err4 = { instancePath: instancePath + "/entries", schemaPath: "#/properties/entries/uniqueItems", keyword: "uniqueItems", params: { i: i1, j: j0 }, message: "must NOT have duplicate items (items ## " + j0 + " and " + i1 + " are identical)" };
                if (vErrors === null) {
                  vErrors = [err4];
                } else {
                  vErrors.push(err4);
                }
                errors++;
                break outer0;
              }
            }
          }
        }
      } else {
        const err5 = { instancePath: instancePath + "/entries", schemaPath: "#/properties/entries/type", keyword: "type", params: { type: "array" }, message: "must be array" };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
  } else {
    const err6 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err6];
    } else {
      vErrors.push(err6);
    }
    errors++;
  }
  validate34.errors = vErrors;
  return errors === 0;
}
validate34.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
function validate31(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate31.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  const _errs0 = errors;
  let valid0 = false;
  let passing0 = null;
  const _errs1 = errors;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.kind === void 0 || !func0.call(data, "kind")) {
      const err0 = { instancePath, schemaPath: "#/$defs/CanonicalNull/required", keyword: "required", params: { missingProperty: "kind" }, message: "must have required property 'kind'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    for (const key0 of Object.keys(data)) {
      if (!(key0 === "kind")) {
        const err1 = { instancePath, schemaPath: "#/$defs/CanonicalNull/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err1];
        } else {
          vErrors.push(err1);
        }
        errors++;
      }
    }
    if (data.kind !== void 0 && func0.call(data, "kind")) {
      if ("null" !== data.kind) {
        const err2 = { instancePath: instancePath + "/kind", schemaPath: "#/$defs/CanonicalNull/properties/kind/const", keyword: "const", params: { allowedValue: "null" }, message: "must be equal to constant" };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
  } else {
    const err3 = { instancePath, schemaPath: "#/$defs/CanonicalNull/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err3];
    } else {
      vErrors.push(err3);
    }
    errors++;
  }
  var _valid0 = _errs1 === errors;
  if (_valid0) {
    valid0 = true;
    passing0 = 0;
    var props0 = true;
  }
  const _errs6 = errors;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.kind === void 0 || !func0.call(data, "kind")) {
      const err4 = { instancePath, schemaPath: "#/$defs/CanonicalBoolean/required", keyword: "required", params: { missingProperty: "kind" }, message: "must have required property 'kind'" };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    if (data.value === void 0 || !func0.call(data, "value")) {
      const err5 = { instancePath, schemaPath: "#/$defs/CanonicalBoolean/required", keyword: "required", params: { missingProperty: "value" }, message: "must have required property 'value'" };
      if (vErrors === null) {
        vErrors = [err5];
      } else {
        vErrors.push(err5);
      }
      errors++;
    }
    for (const key1 of Object.keys(data)) {
      if (!(key1 === "kind" || key1 === "value")) {
        const err6 = { instancePath, schemaPath: "#/$defs/CanonicalBoolean/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
    if (data.kind !== void 0 && func0.call(data, "kind")) {
      if ("boolean" !== data.kind) {
        const err7 = { instancePath: instancePath + "/kind", schemaPath: "#/$defs/CanonicalBoolean/properties/kind/const", keyword: "const", params: { allowedValue: "boolean" }, message: "must be equal to constant" };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
    }
    if (data.value !== void 0 && func0.call(data, "value")) {
      if (typeof data.value !== "boolean") {
        const err8 = { instancePath: instancePath + "/value", schemaPath: "#/$defs/CanonicalBoolean/properties/value/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      }
    }
  } else {
    const err9 = { instancePath, schemaPath: "#/$defs/CanonicalBoolean/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err9];
    } else {
      vErrors.push(err9);
    }
    errors++;
  }
  var _valid0 = _errs6 === errors;
  if (_valid0 && valid0) {
    valid0 = false;
    passing0 = [passing0, 1];
  } else {
    if (_valid0) {
      valid0 = true;
      passing0 = 1;
      if (props0 !== true) {
        props0 = true;
      }
    }
    const _errs13 = errors;
    if (data && typeof data == "object" && !Array.isArray(data)) {
      if (data.kind === void 0 || !func0.call(data, "kind")) {
        const err10 = { instancePath, schemaPath: "#/$defs/CanonicalString/required", keyword: "required", params: { missingProperty: "kind" }, message: "must have required property 'kind'" };
        if (vErrors === null) {
          vErrors = [err10];
        } else {
          vErrors.push(err10);
        }
        errors++;
      }
      if (data.value === void 0 || !func0.call(data, "value")) {
        const err11 = { instancePath, schemaPath: "#/$defs/CanonicalString/required", keyword: "required", params: { missingProperty: "value" }, message: "must have required property 'value'" };
        if (vErrors === null) {
          vErrors = [err11];
        } else {
          vErrors.push(err11);
        }
        errors++;
      }
      for (const key2 of Object.keys(data)) {
        if (!(key2 === "kind" || key2 === "value")) {
          const err12 = { instancePath, schemaPath: "#/$defs/CanonicalString/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key2 }, message: "must NOT have additional properties" };
          if (vErrors === null) {
            vErrors = [err12];
          } else {
            vErrors.push(err12);
          }
          errors++;
        }
      }
      if (data.kind !== void 0 && func0.call(data, "kind")) {
        if ("string" !== data.kind) {
          const err13 = { instancePath: instancePath + "/kind", schemaPath: "#/$defs/CanonicalString/properties/kind/const", keyword: "const", params: { allowedValue: "string" }, message: "must be equal to constant" };
          if (vErrors === null) {
            vErrors = [err13];
          } else {
            vErrors.push(err13);
          }
          errors++;
        }
      }
      if (data.value !== void 0 && func0.call(data, "value")) {
        if (typeof data.value !== "string") {
          const err14 = { instancePath: instancePath + "/value", schemaPath: "#/$defs/CanonicalString/properties/value/type", keyword: "type", params: { type: "string" }, message: "must be string" };
          if (vErrors === null) {
            vErrors = [err14];
          } else {
            vErrors.push(err14);
          }
          errors++;
        }
      }
    } else {
      const err15 = { instancePath, schemaPath: "#/$defs/CanonicalString/type", keyword: "type", params: { type: "object" }, message: "must be object" };
      if (vErrors === null) {
        vErrors = [err15];
      } else {
        vErrors.push(err15);
      }
      errors++;
    }
    var _valid0 = _errs13 === errors;
    if (_valid0 && valid0) {
      valid0 = false;
      passing0 = [passing0, 2];
    } else {
      if (_valid0) {
        valid0 = true;
        passing0 = 2;
        if (props0 !== true) {
          props0 = true;
        }
      }
      const _errs20 = errors;
      if (data && typeof data == "object" && !Array.isArray(data)) {
        if (data.kind === void 0 || !func0.call(data, "kind")) {
          const err16 = { instancePath, schemaPath: "#/$defs/CanonicalNumber/required", keyword: "required", params: { missingProperty: "kind" }, message: "must have required property 'kind'" };
          if (vErrors === null) {
            vErrors = [err16];
          } else {
            vErrors.push(err16);
          }
          errors++;
        }
        if (data.decimal === void 0 || !func0.call(data, "decimal")) {
          const err17 = { instancePath, schemaPath: "#/$defs/CanonicalNumber/required", keyword: "required", params: { missingProperty: "decimal" }, message: "must have required property 'decimal'" };
          if (vErrors === null) {
            vErrors = [err17];
          } else {
            vErrors.push(err17);
          }
          errors++;
        }
        for (const key3 of Object.keys(data)) {
          if (!(key3 === "kind" || key3 === "decimal")) {
            const err18 = { instancePath, schemaPath: "#/$defs/CanonicalNumber/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key3 }, message: "must NOT have additional properties" };
            if (vErrors === null) {
              vErrors = [err18];
            } else {
              vErrors.push(err18);
            }
            errors++;
          }
        }
        if (data.kind !== void 0 && func0.call(data, "kind")) {
          if ("number" !== data.kind) {
            const err19 = { instancePath: instancePath + "/kind", schemaPath: "#/$defs/CanonicalNumber/properties/kind/const", keyword: "const", params: { allowedValue: "number" }, message: "must be equal to constant" };
            if (vErrors === null) {
              vErrors = [err19];
            } else {
              vErrors.push(err19);
            }
            errors++;
          }
        }
        if (data.decimal !== void 0 && func0.call(data, "decimal")) {
          let data6 = data.decimal;
          if (typeof data6 === "string") {
            if (!pattern10.test(data6)) {
              const err20 = { instancePath: instancePath + "/decimal", schemaPath: "#/$defs/CanonicalNumber/properties/decimal/pattern", keyword: "pattern", params: { pattern: "^(?:0e0|-?[1-9](?:[0-9]*[1-9])?e-?(?:0|[1-9][0-9]*))$" }, message: 'must match pattern "^(?:0e0|-?[1-9](?:[0-9]*[1-9])?e-?(?:0|[1-9][0-9]*))$"' };
              if (vErrors === null) {
                vErrors = [err20];
              } else {
                vErrors.push(err20);
              }
              errors++;
            }
          } else {
            const err21 = { instancePath: instancePath + "/decimal", schemaPath: "#/$defs/CanonicalNumber/properties/decimal/type", keyword: "type", params: { type: "string" }, message: "must be string" };
            if (vErrors === null) {
              vErrors = [err21];
            } else {
              vErrors.push(err21);
            }
            errors++;
          }
        }
      } else {
        const err22 = { instancePath, schemaPath: "#/$defs/CanonicalNumber/type", keyword: "type", params: { type: "object" }, message: "must be object" };
        if (vErrors === null) {
          vErrors = [err22];
        } else {
          vErrors.push(err22);
        }
        errors++;
      }
      var _valid0 = _errs20 === errors;
      if (_valid0 && valid0) {
        valid0 = false;
        passing0 = [passing0, 3];
      } else {
        if (_valid0) {
          valid0 = true;
          passing0 = 3;
          if (props0 !== true) {
            props0 = true;
          }
        }
        const _errs27 = errors;
        if (!validate32(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
          vErrors = vErrors === null ? validate32.errors : vErrors.concat(validate32.errors);
          errors = vErrors.length;
        }
        var _valid0 = _errs27 === errors;
        if (_valid0 && valid0) {
          valid0 = false;
          passing0 = [passing0, 4];
        } else {
          if (_valid0) {
            valid0 = true;
            passing0 = 4;
            if (props0 !== true) {
              props0 = true;
            }
          }
          const _errs28 = errors;
          if (!validate34(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
            vErrors = vErrors === null ? validate34.errors : vErrors.concat(validate34.errors);
            errors = vErrors.length;
          }
          var _valid0 = _errs28 === errors;
          if (_valid0 && valid0) {
            valid0 = false;
            passing0 = [passing0, 5];
          } else {
            if (_valid0) {
              valid0 = true;
              passing0 = 5;
              if (props0 !== true) {
                props0 = true;
              }
            }
          }
        }
      }
    }
  }
  if (!valid0) {
    const err23 = { instancePath, schemaPath: "#/oneOf", keyword: "oneOf", params: { passingSchemas: passing0 }, message: "must match exactly one schema in oneOf" };
    if (vErrors === null) {
      vErrors = [err23];
    } else {
      vErrors.push(err23);
    }
    errors++;
  } else {
    errors = _errs0;
    if (vErrors !== null) {
      if (_errs0) {
        vErrors.length = _errs0;
      } else {
        vErrors = null;
      }
    }
  }
  validate31.errors = vErrors;
  evaluated0.props = props0;
  return errors === 0;
}
validate31.evaluated = { "dynamicProps": true, "dynamicItems": false };
var wrapper2 = { validate: validate30 };
function validate39(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate39.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  const _errs1 = errors;
  const _errs2 = errors;
  if (errors === _errs2) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if ((data.kind === void 0 || !func0.call(data, "kind")) && (missing0 = "kind")) {
        const err0 = {};
        if (vErrors === null) {
          vErrors = [err0];
        } else {
          vErrors.push(err0);
        }
        errors++;
      } else {
        if (data.kind !== void 0 && func0.call(data, "kind")) {
          let data0 = data.kind;
          if (!(data0 === "null" || data0 === "boolean" || data0 === "string" || data0 === "number" || data0 === "array" || data0 === "object")) {
            const err1 = {};
            if (vErrors === null) {
              vErrors = [err1];
            } else {
              vErrors.push(err1);
            }
            errors++;
          }
        }
      }
    } else {
      const err2 = {};
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
  }
  var valid0 = _errs2 === errors;
  if (valid0) {
    const err3 = { instancePath, schemaPath: "#/not", keyword: "not", params: {}, message: "must NOT be valid" };
    if (vErrors === null) {
      vErrors = [err3];
    } else {
      vErrors.push(err3);
    }
    errors++;
  } else {
    errors = _errs1;
    if (vErrors !== null) {
      if (_errs1) {
        vErrors.length = _errs1;
      } else {
        vErrors = null;
      }
    }
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    for (const key0 of Object.keys(data)) {
      if (!wrapper2.validate(data[key0], { instancePath: instancePath + "/" + key0.replace(/~/g, "~0").replace(/\//g, "~1"), parentData: data, parentDataProperty: key0, rootData, dynamicAnchors })) {
        vErrors = vErrors === null ? wrapper2.validate.errors : vErrors.concat(wrapper2.validate.errors);
        errors = vErrors.length;
      }
    }
  } else {
    const err4 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err4];
    } else {
      vErrors.push(err4);
    }
    errors++;
  }
  validate39.errors = vErrors;
  return errors === 0;
}
validate39.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
function validate30(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate30.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  const _errs0 = errors;
  let valid0 = false;
  let passing0 = null;
  const _errs1 = errors;
  if (data !== null) {
    const err0 = { instancePath, schemaPath: "#/oneOf/0/type", keyword: "type", params: { type: "null" }, message: "must be null" };
    if (vErrors === null) {
      vErrors = [err0];
    } else {
      vErrors.push(err0);
    }
    errors++;
  }
  var _valid0 = _errs1 === errors;
  if (_valid0) {
    valid0 = true;
    passing0 = 0;
  }
  const _errs3 = errors;
  if (typeof data !== "boolean") {
    const err1 = { instancePath, schemaPath: "#/oneOf/1/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" };
    if (vErrors === null) {
      vErrors = [err1];
    } else {
      vErrors.push(err1);
    }
    errors++;
  }
  var _valid0 = _errs3 === errors;
  if (_valid0 && valid0) {
    valid0 = false;
    passing0 = [passing0, 1];
  } else {
    if (_valid0) {
      valid0 = true;
      passing0 = 1;
    }
    const _errs5 = errors;
    if (typeof data !== "string") {
      const err2 = { instancePath, schemaPath: "#/oneOf/2/type", keyword: "type", params: { type: "string" }, message: "must be string" };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    var _valid0 = _errs5 === errors;
    if (_valid0 && valid0) {
      valid0 = false;
      passing0 = [passing0, 2];
    } else {
      if (_valid0) {
        valid0 = true;
        passing0 = 2;
      }
      const _errs7 = errors;
      if (!validate31(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
        vErrors = vErrors === null ? validate31.errors : vErrors.concat(validate31.errors);
        errors = vErrors.length;
      } else {
        var props0 = validate31.evaluated.props;
      }
      var _valid0 = _errs7 === errors;
      if (_valid0 && valid0) {
        valid0 = false;
        passing0 = [passing0, 3];
      } else {
        if (_valid0) {
          valid0 = true;
          passing0 = 3;
        }
        const _errs8 = errors;
        if (Array.isArray(data)) {
          const len0 = data.length;
          for (let i0 = 0; i0 < len0; i0++) {
            if (!wrapper2.validate(data[i0], { instancePath: instancePath + "/" + i0, parentData: data, parentDataProperty: i0, rootData, dynamicAnchors })) {
              vErrors = vErrors === null ? wrapper2.validate.errors : vErrors.concat(wrapper2.validate.errors);
              errors = vErrors.length;
            }
          }
        } else {
          const err3 = { instancePath, schemaPath: "#/oneOf/4/type", keyword: "type", params: { type: "array" }, message: "must be array" };
          if (vErrors === null) {
            vErrors = [err3];
          } else {
            vErrors.push(err3);
          }
          errors++;
        }
        var _valid0 = _errs8 === errors;
        if (_valid0 && valid0) {
          valid0 = false;
          passing0 = [passing0, 4];
        } else {
          if (_valid0) {
            valid0 = true;
            passing0 = 4;
            var items1 = true;
          }
          const _errs11 = errors;
          if (!validate39(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
            vErrors = vErrors === null ? validate39.errors : vErrors.concat(validate39.errors);
            errors = vErrors.length;
          }
          var _valid0 = _errs11 === errors;
          if (_valid0 && valid0) {
            valid0 = false;
            passing0 = [passing0, 5];
          } else {
            if (_valid0) {
              valid0 = true;
              passing0 = 5;
              if (props0 !== true) {
                props0 = true;
              }
            }
          }
        }
      }
    }
  }
  if (!valid0) {
    const err4 = { instancePath, schemaPath: "#/oneOf", keyword: "oneOf", params: { passingSchemas: passing0 }, message: "must match exactly one schema in oneOf" };
    if (vErrors === null) {
      vErrors = [err4];
    } else {
      vErrors.push(err4);
    }
    errors++;
  } else {
    errors = _errs0;
    if (vErrors !== null) {
      if (_errs0) {
        vErrors.length = _errs0;
      } else {
        vErrors = null;
      }
    }
  }
  validate30.errors = vErrors;
  evaluated0.props = props0;
  evaluated0.items = items1;
  return errors === 0;
}
validate30.evaluated = { "dynamicProps": true, "dynamicItems": true };
function validate25(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate25.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.change_id === void 0 || !func0.call(data, "change_id")) {
      const err0 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "change_id" }, message: "must have required property 'change_id'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.fingerprint_version === void 0 || !func0.call(data, "fingerprint_version")) {
      const err1 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "fingerprint_version" }, message: "must have required property 'fingerprint_version'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.schema_kind === void 0 || !func0.call(data, "schema_kind")) {
      const err2 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "schema_kind" }, message: "must have required property 'schema_kind'" };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.target === void 0 || !func0.call(data, "target")) {
      const err3 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "target" }, message: "must have required property 'target'" };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.kind === void 0 || !func0.call(data, "kind")) {
      const err4 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "kind" }, message: "must have required property 'kind'" };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    if (data.compatibility === void 0 || !func0.call(data, "compatibility")) {
      const err5 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "compatibility" }, message: "must have required property 'compatibility'" };
      if (vErrors === null) {
        vErrors = [err5];
      } else {
        vErrors.push(err5);
      }
      errors++;
    }
    if (data.change_id !== void 0 && func0.call(data, "change_id")) {
      let data0 = data.change_id;
      if (typeof data0 === "string") {
        if (!pattern8.test(data0)) {
          const err6 = { instancePath: instancePath + "/change_id", schemaPath: "#/$defs/ChangeId/pattern", keyword: "pattern", params: { pattern: "^chg_sha256_[0-9a-f]{64}$" }, message: 'must match pattern "^chg_sha256_[0-9a-f]{64}$"' };
          if (vErrors === null) {
            vErrors = [err6];
          } else {
            vErrors.push(err6);
          }
          errors++;
        }
      } else {
        const err7 = { instancePath: instancePath + "/change_id", schemaPath: "#/$defs/ChangeId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
    }
    if (data.fingerprint_version !== void 0 && func0.call(data, "fingerprint_version")) {
      if (1 !== data.fingerprint_version) {
        const err8 = { instancePath: instancePath + "/fingerprint_version", schemaPath: "#/properties/fingerprint_version/const", keyword: "const", params: { allowedValue: 1 }, message: "must be equal to constant" };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      }
    }
    if (data.schema_kind !== void 0 && func0.call(data, "schema_kind")) {
      let data2 = data.schema_kind;
      if (typeof data2 === "string") {
        if (func74(data2) < 1) {
          const err9 = { instancePath: instancePath + "/schema_kind", schemaPath: "#/$defs/NonEmptyString/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err9];
          } else {
            vErrors.push(err9);
          }
          errors++;
        }
      } else {
        const err10 = { instancePath: instancePath + "/schema_kind", schemaPath: "#/$defs/NonEmptyString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err10];
        } else {
          vErrors.push(err10);
        }
        errors++;
      }
    }
    if (data.target !== void 0 && func0.call(data, "target")) {
      if (!validate26(data.target, { instancePath: instancePath + "/target", parentData: data, parentDataProperty: "target", rootData, dynamicAnchors })) {
        vErrors = vErrors === null ? validate26.errors : vErrors.concat(validate26.errors);
        errors = vErrors.length;
      }
    }
    if (data.kind !== void 0 && func0.call(data, "kind")) {
      let data4 = data.kind;
      const _errs12 = errors;
      let valid4 = false;
      let passing0 = null;
      const _errs13 = errors;
      if (typeof data4 !== "string") {
        const err11 = { instancePath: instancePath + "/kind", schemaPath: "#/$defs/ChangeKind/oneOf/0/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err11];
        } else {
          vErrors.push(err11);
        }
        errors++;
      }
      if (!(data4 === "object_add" || data4 === "add" || data4 === "object_remove" || data4 === "remove" || data4 === "rename" || data4 === "retype" || data4 === "make_required" || data4 === "make_optional" || data4 === "make_non_nullable" || data4 === "make_nullable" || data4 === "enum_narrow" || data4 === "enum_widen" || data4 === "format_change" || data4 === "constraint_change" || data4 === "deprecate" || data4 === "unknown")) {
        const err12 = { instancePath: instancePath + "/kind", schemaPath: "#/$defs/ChangeKind/oneOf/0/enum", keyword: "enum", params: { allowedValues: schema50.oneOf[0].enum }, message: "must be equal to one of the allowed values" };
        if (vErrors === null) {
          vErrors = [err12];
        } else {
          vErrors.push(err12);
        }
        errors++;
      }
      var _valid0 = _errs13 === errors;
      if (_valid0) {
        valid4 = true;
        passing0 = 0;
      }
      const _errs15 = errors;
      if (typeof data4 === "string") {
        if (!pattern9.test(data4)) {
          const err13 = { instancePath: instancePath + "/kind", schemaPath: "#/$defs/ChangeKind/oneOf/1/pattern", keyword: "pattern", params: { pattern: "^[^:]+:.+$" }, message: 'must match pattern "^[^:]+:.+$"' };
          if (vErrors === null) {
            vErrors = [err13];
          } else {
            vErrors.push(err13);
          }
          errors++;
        }
      } else {
        const err14 = { instancePath: instancePath + "/kind", schemaPath: "#/$defs/ChangeKind/oneOf/1/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err14];
        } else {
          vErrors.push(err14);
        }
        errors++;
      }
      var _valid0 = _errs15 === errors;
      if (_valid0 && valid4) {
        valid4 = false;
        passing0 = [passing0, 1];
      } else {
        if (_valid0) {
          valid4 = true;
          passing0 = 1;
        }
      }
      if (!valid4) {
        const err15 = { instancePath: instancePath + "/kind", schemaPath: "#/$defs/ChangeKind/oneOf", keyword: "oneOf", params: { passingSchemas: passing0 }, message: "must match exactly one schema in oneOf" };
        if (vErrors === null) {
          vErrors = [err15];
        } else {
          vErrors.push(err15);
        }
        errors++;
      } else {
        errors = _errs12;
        if (vErrors !== null) {
          if (_errs12) {
            vErrors.length = _errs12;
          } else {
            vErrors = null;
          }
        }
      }
    }
    if (data.compatibility !== void 0 && func0.call(data, "compatibility")) {
      let data5 = data.compatibility;
      if (typeof data5 !== "string") {
        const err16 = { instancePath: instancePath + "/compatibility", schemaPath: "#/properties/compatibility/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err16];
        } else {
          vErrors.push(err16);
        }
        errors++;
      }
      if (!(data5 === "compatible" || data5 === "breaking" || data5 === "unknown")) {
        const err17 = { instancePath: instancePath + "/compatibility", schemaPath: "#/properties/compatibility/enum", keyword: "enum", params: { allowedValues: schema41.properties.compatibility.enum }, message: "must be equal to one of the allowed values" };
        if (vErrors === null) {
          vErrors = [err17];
        } else {
          vErrors.push(err17);
        }
        errors++;
      }
    }
    if (data.before !== void 0 && func0.call(data, "before")) {
      if (!validate30(data.before, { instancePath: instancePath + "/before", parentData: data, parentDataProperty: "before", rootData, dynamicAnchors })) {
        vErrors = vErrors === null ? validate30.errors : vErrors.concat(validate30.errors);
        errors = vErrors.length;
      }
    }
    if (data.after !== void 0 && func0.call(data, "after")) {
      if (!validate30(data.after, { instancePath: instancePath + "/after", parentData: data, parentDataProperty: "after", rootData, dynamicAnchors })) {
        vErrors = vErrors === null ? validate30.errors : vErrors.concat(validate30.errors);
        errors = vErrors.length;
      }
    }
  } else {
    const err18 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err18];
    } else {
      vErrors.push(err18);
    }
    errors++;
  }
  validate25.errors = vErrors;
  return errors === 0;
}
validate25.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
function validate24(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate24.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (!validate25(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
    vErrors = vErrors === null ? validate25.errors : vErrors.concat(validate25.errors);
    errors = vErrors.length;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.kind === void 0 || !func0.call(data, "kind")) {
      const err0 = { instancePath, schemaPath: "#/allOf/1/required", keyword: "required", params: { missingProperty: "kind" }, message: "must have required property 'kind'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.after === void 0 || !func0.call(data, "after")) {
      const err1 = { instancePath, schemaPath: "#/allOf/1/required", keyword: "required", params: { missingProperty: "after" }, message: "must have required property 'after'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.kind !== void 0 && func0.call(data, "kind")) {
      let data0 = data.kind;
      if (!(data0 === "object_add" || data0 === "add")) {
        const err2 = { instancePath: instancePath + "/kind", schemaPath: "#/allOf/1/properties/kind/enum", keyword: "enum", params: { allowedValues: schema40.allOf[1].properties.kind.enum }, message: "must be equal to one of the allowed values" };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    if (data.after !== void 0 && func0.call(data, "after")) {
      if (!validate30(data.after, { instancePath: instancePath + "/after", parentData: data, parentDataProperty: "after", rootData, dynamicAnchors })) {
        vErrors = vErrors === null ? validate30.errors : vErrors.concat(validate30.errors);
        errors = vErrors.length;
      }
    }
    if (data.before !== void 0 && func0.call(data, "before")) {
      const err3 = { instancePath: instancePath + "/before", schemaPath: "#/allOf/1/properties/before/false schema", keyword: "false schema", params: {}, message: "boolean schema is false" };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
  } else {
    const err4 = { instancePath, schemaPath: "#/allOf/1/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err4];
    } else {
      vErrors.push(err4);
    }
    errors++;
  }
  validate24.errors = vErrors;
  return errors === 0;
}
validate24.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var schema61 = { "title": "Remove Change", "allOf": [{ "$ref": "#/$defs/NormalizedChangeCore" }, { "type": "object", "required": ["kind", "before"], "properties": { "kind": { "enum": ["object_remove", "remove"] }, "before": { "$ref": "#/$defs/SnapshotValue" }, "after": false } }] };
function validate46(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate46.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (!validate25(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
    vErrors = vErrors === null ? validate25.errors : vErrors.concat(validate25.errors);
    errors = vErrors.length;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.kind === void 0 || !func0.call(data, "kind")) {
      const err0 = { instancePath, schemaPath: "#/allOf/1/required", keyword: "required", params: { missingProperty: "kind" }, message: "must have required property 'kind'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.before === void 0 || !func0.call(data, "before")) {
      const err1 = { instancePath, schemaPath: "#/allOf/1/required", keyword: "required", params: { missingProperty: "before" }, message: "must have required property 'before'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.kind !== void 0 && func0.call(data, "kind")) {
      let data0 = data.kind;
      if (!(data0 === "object_remove" || data0 === "remove")) {
        const err2 = { instancePath: instancePath + "/kind", schemaPath: "#/allOf/1/properties/kind/enum", keyword: "enum", params: { allowedValues: schema61.allOf[1].properties.kind.enum }, message: "must be equal to one of the allowed values" };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    if (data.before !== void 0 && func0.call(data, "before")) {
      if (!validate30(data.before, { instancePath: instancePath + "/before", parentData: data, parentDataProperty: "before", rootData, dynamicAnchors })) {
        vErrors = vErrors === null ? validate30.errors : vErrors.concat(validate30.errors);
        errors = vErrors.length;
      }
    }
    if (data.after !== void 0 && func0.call(data, "after")) {
      const err3 = { instancePath: instancePath + "/after", schemaPath: "#/allOf/1/properties/after/false schema", keyword: "false schema", params: {}, message: "boolean schema is false" };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
  } else {
    const err4 = { instancePath, schemaPath: "#/allOf/1/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err4];
    } else {
      vErrors.push(err4);
    }
    errors++;
  }
  validate46.errors = vErrors;
  return errors === 0;
}
validate46.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var schema62 = { "title": "Before and After Change", "allOf": [{ "$ref": "#/$defs/NormalizedChangeCore" }, { "type": "object", "required": ["kind", "before", "after"], "properties": { "kind": { "enum": ["rename", "retype", "make_required", "make_optional", "make_non_nullable", "make_nullable", "enum_narrow", "enum_widen", "format_change", "constraint_change", "deprecate"] }, "before": { "$ref": "#/$defs/SnapshotValue" }, "after": { "$ref": "#/$defs/SnapshotValue" } } }] };
function validate50(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate50.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (!validate25(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
    vErrors = vErrors === null ? validate25.errors : vErrors.concat(validate25.errors);
    errors = vErrors.length;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.kind === void 0 || !func0.call(data, "kind")) {
      const err0 = { instancePath, schemaPath: "#/allOf/1/required", keyword: "required", params: { missingProperty: "kind" }, message: "must have required property 'kind'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.before === void 0 || !func0.call(data, "before")) {
      const err1 = { instancePath, schemaPath: "#/allOf/1/required", keyword: "required", params: { missingProperty: "before" }, message: "must have required property 'before'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.after === void 0 || !func0.call(data, "after")) {
      const err2 = { instancePath, schemaPath: "#/allOf/1/required", keyword: "required", params: { missingProperty: "after" }, message: "must have required property 'after'" };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.kind !== void 0 && func0.call(data, "kind")) {
      let data0 = data.kind;
      if (!(data0 === "rename" || data0 === "retype" || data0 === "make_required" || data0 === "make_optional" || data0 === "make_non_nullable" || data0 === "make_nullable" || data0 === "enum_narrow" || data0 === "enum_widen" || data0 === "format_change" || data0 === "constraint_change" || data0 === "deprecate")) {
        const err3 = { instancePath: instancePath + "/kind", schemaPath: "#/allOf/1/properties/kind/enum", keyword: "enum", params: { allowedValues: schema62.allOf[1].properties.kind.enum }, message: "must be equal to one of the allowed values" };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
    if (data.before !== void 0 && func0.call(data, "before")) {
      if (!validate30(data.before, { instancePath: instancePath + "/before", parentData: data, parentDataProperty: "before", rootData, dynamicAnchors })) {
        vErrors = vErrors === null ? validate30.errors : vErrors.concat(validate30.errors);
        errors = vErrors.length;
      }
    }
    if (data.after !== void 0 && func0.call(data, "after")) {
      if (!validate30(data.after, { instancePath: instancePath + "/after", parentData: data, parentDataProperty: "after", rootData, dynamicAnchors })) {
        vErrors = vErrors === null ? validate30.errors : vErrors.concat(validate30.errors);
        errors = vErrors.length;
      }
    }
  } else {
    const err4 = { instancePath, schemaPath: "#/allOf/1/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err4];
    } else {
      vErrors.push(err4);
    }
    errors++;
  }
  validate50.errors = vErrors;
  return errors === 0;
}
validate50.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
function validate55(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate55.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  const _errs0 = errors;
  let valid0 = false;
  const _errs1 = errors;
  if (!validate25(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
    vErrors = vErrors === null ? validate25.errors : vErrors.concat(validate25.errors);
    errors = vErrors.length;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.kind === void 0 || !func0.call(data, "kind")) {
      const err0 = { instancePath, schemaPath: "#/anyOf/0/allOf/1/required", keyword: "required", params: { missingProperty: "kind" }, message: "must have required property 'kind'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.before === void 0 || !func0.call(data, "before")) {
      const err1 = { instancePath, schemaPath: "#/anyOf/0/allOf/1/required", keyword: "required", params: { missingProperty: "before" }, message: "must have required property 'before'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.kind !== void 0 && func0.call(data, "kind")) {
      if ("unknown" !== data.kind) {
        const err2 = { instancePath: instancePath + "/kind", schemaPath: "#/anyOf/0/allOf/1/properties/kind/const", keyword: "const", params: { allowedValue: "unknown" }, message: "must be equal to constant" };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    if (data.before !== void 0 && func0.call(data, "before")) {
      if (!validate30(data.before, { instancePath: instancePath + "/before", parentData: data, parentDataProperty: "before", rootData, dynamicAnchors })) {
        vErrors = vErrors === null ? validate30.errors : vErrors.concat(validate30.errors);
        errors = vErrors.length;
      }
    }
  } else {
    const err3 = { instancePath, schemaPath: "#/anyOf/0/allOf/1/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err3];
    } else {
      vErrors.push(err3);
    }
    errors++;
  }
  var _valid0 = _errs1 === errors;
  valid0 = valid0 || _valid0;
  if (_valid0) {
    var props1 = true;
  }
  const _errs7 = errors;
  if (!validate25(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
    vErrors = vErrors === null ? validate25.errors : vErrors.concat(validate25.errors);
    errors = vErrors.length;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.kind === void 0 || !func0.call(data, "kind")) {
      const err4 = { instancePath, schemaPath: "#/anyOf/1/allOf/1/required", keyword: "required", params: { missingProperty: "kind" }, message: "must have required property 'kind'" };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    if (data.after === void 0 || !func0.call(data, "after")) {
      const err5 = { instancePath, schemaPath: "#/anyOf/1/allOf/1/required", keyword: "required", params: { missingProperty: "after" }, message: "must have required property 'after'" };
      if (vErrors === null) {
        vErrors = [err5];
      } else {
        vErrors.push(err5);
      }
      errors++;
    }
    if (data.kind !== void 0 && func0.call(data, "kind")) {
      if ("unknown" !== data.kind) {
        const err6 = { instancePath: instancePath + "/kind", schemaPath: "#/anyOf/1/allOf/1/properties/kind/const", keyword: "const", params: { allowedValue: "unknown" }, message: "must be equal to constant" };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
    if (data.after !== void 0 && func0.call(data, "after")) {
      if (!validate30(data.after, { instancePath: instancePath + "/after", parentData: data, parentDataProperty: "after", rootData, dynamicAnchors })) {
        vErrors = vErrors === null ? validate30.errors : vErrors.concat(validate30.errors);
        errors = vErrors.length;
      }
    }
  } else {
    const err7 = { instancePath, schemaPath: "#/anyOf/1/allOf/1/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err7];
    } else {
      vErrors.push(err7);
    }
    errors++;
  }
  var _valid0 = _errs7 === errors;
  valid0 = valid0 || _valid0;
  if (_valid0) {
    if (props1 !== true) {
      props1 = true;
    }
  }
  if (!valid0) {
    const err8 = { instancePath, schemaPath: "#/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
    if (vErrors === null) {
      vErrors = [err8];
    } else {
      vErrors.push(err8);
    }
    errors++;
  } else {
    errors = _errs0;
    if (vErrors !== null) {
      if (_errs0) {
        vErrors.length = _errs0;
      } else {
        vErrors = null;
      }
    }
  }
  validate55.errors = vErrors;
  evaluated0.props = props1;
  return errors === 0;
}
validate55.evaluated = { "dynamicProps": true, "dynamicItems": false };
function validate61(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate61.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (!validate25(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
    vErrors = vErrors === null ? validate25.errors : vErrors.concat(validate25.errors);
    errors = vErrors.length;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.kind === void 0 || !func0.call(data, "kind")) {
      const err0 = { instancePath, schemaPath: "#/allOf/1/required", keyword: "required", params: { missingProperty: "kind" }, message: "must have required property 'kind'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.kind !== void 0 && func0.call(data, "kind")) {
      let data0 = data.kind;
      if (typeof data0 === "string") {
        if (!pattern9.test(data0)) {
          const err1 = { instancePath: instancePath + "/kind", schemaPath: "#/allOf/1/properties/kind/pattern", keyword: "pattern", params: { pattern: "^[^:]+:.+$" }, message: 'must match pattern "^[^:]+:.+$"' };
          if (vErrors === null) {
            vErrors = [err1];
          } else {
            vErrors.push(err1);
          }
          errors++;
        }
      } else {
        const err2 = { instancePath: instancePath + "/kind", schemaPath: "#/allOf/1/properties/kind/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
  } else {
    const err3 = { instancePath, schemaPath: "#/allOf/1/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err3];
    } else {
      vErrors.push(err3);
    }
    errors++;
  }
  validate61.errors = vErrors;
  return errors === 0;
}
validate61.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
function validate23(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate23.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  const _errs0 = errors;
  let valid0 = false;
  let passing0 = null;
  const _errs1 = errors;
  if (!validate24(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
    vErrors = vErrors === null ? validate24.errors : vErrors.concat(validate24.errors);
    errors = vErrors.length;
  }
  var _valid0 = _errs1 === errors;
  if (_valid0) {
    valid0 = true;
    passing0 = 0;
    var props0 = true;
  }
  const _errs2 = errors;
  if (!validate46(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
    vErrors = vErrors === null ? validate46.errors : vErrors.concat(validate46.errors);
    errors = vErrors.length;
  }
  var _valid0 = _errs2 === errors;
  if (_valid0 && valid0) {
    valid0 = false;
    passing0 = [passing0, 1];
  } else {
    if (_valid0) {
      valid0 = true;
      passing0 = 1;
      if (props0 !== true) {
        props0 = true;
      }
    }
    const _errs3 = errors;
    if (!validate50(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
      vErrors = vErrors === null ? validate50.errors : vErrors.concat(validate50.errors);
      errors = vErrors.length;
    }
    var _valid0 = _errs3 === errors;
    if (_valid0 && valid0) {
      valid0 = false;
      passing0 = [passing0, 2];
    } else {
      if (_valid0) {
        valid0 = true;
        passing0 = 2;
        if (props0 !== true) {
          props0 = true;
        }
      }
      const _errs4 = errors;
      if (!validate55(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
        vErrors = vErrors === null ? validate55.errors : vErrors.concat(validate55.errors);
        errors = vErrors.length;
      } else {
        var props1 = validate55.evaluated.props;
      }
      var _valid0 = _errs4 === errors;
      if (_valid0 && valid0) {
        valid0 = false;
        passing0 = [passing0, 3];
      } else {
        if (_valid0) {
          valid0 = true;
          passing0 = 3;
          if (props0 !== true && props1 !== void 0) {
            if (props1 === true) {
              props0 = true;
            } else {
              props0 = props0 || {};
              Object.assign(props0, props1);
            }
          }
        }
        const _errs5 = errors;
        if (!validate61(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
          vErrors = vErrors === null ? validate61.errors : vErrors.concat(validate61.errors);
          errors = vErrors.length;
        }
        var _valid0 = _errs5 === errors;
        if (_valid0 && valid0) {
          valid0 = false;
          passing0 = [passing0, 4];
        } else {
          if (_valid0) {
            valid0 = true;
            passing0 = 4;
            if (props0 !== true) {
              props0 = true;
            }
          }
        }
      }
    }
  }
  if (!valid0) {
    const err0 = { instancePath, schemaPath: "#/oneOf", keyword: "oneOf", params: { passingSchemas: passing0 }, message: "must match exactly one schema in oneOf" };
    if (vErrors === null) {
      vErrors = [err0];
    } else {
      vErrors.push(err0);
    }
    errors++;
  } else {
    errors = _errs0;
    if (vErrors !== null) {
      if (_errs0) {
        vErrors.length = _errs0;
      } else {
        vErrors = null;
      }
    }
  }
  validate23.errors = vErrors;
  evaluated0.props = props0;
  return errors === 0;
}
validate23.evaluated = { "dynamicProps": true, "dynamicItems": false };
function validate66(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate66.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.strategy === void 0 || !func0.call(data, "strategy")) {
      const err0 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "strategy" }, message: "must have required property 'strategy'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.strategy !== void 0 && func0.call(data, "strategy")) {
      let data0 = data.strategy;
      if (typeof data0 === "string") {
        if (func74(data0) < 1) {
          const err1 = { instancePath: instancePath + "/strategy", schemaPath: "#/$defs/NonEmptyString/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err1];
          } else {
            vErrors.push(err1);
          }
          errors++;
        }
      } else {
        const err2 = { instancePath: instancePath + "/strategy", schemaPath: "#/$defs/NonEmptyString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    if (data.steps !== void 0 && func0.call(data, "steps")) {
      let data1 = data.steps;
      if (Array.isArray(data1)) {
        const len0 = data1.length;
        for (let i0 = 0; i0 < len0; i0++) {
          if (typeof data1[i0] !== "string") {
            const err3 = { instancePath: instancePath + "/steps/" + i0, schemaPath: "#/properties/steps/items/type", keyword: "type", params: { type: "string" }, message: "must be string" };
            if (vErrors === null) {
              vErrors = [err3];
            } else {
              vErrors.push(err3);
            }
            errors++;
          }
        }
      } else {
        const err4 = { instancePath: instancePath + "/steps", schemaPath: "#/properties/steps/type", keyword: "type", params: { type: "array" }, message: "must be array" };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.rollback !== void 0 && func0.call(data, "rollback")) {
      if (typeof data.rollback !== "string") {
        const err5 = { instancePath: instancePath + "/rollback", schemaPath: "#/properties/rollback/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
  } else {
    const err6 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err6];
    } else {
      vErrors.push(err6);
    }
    errors++;
  }
  validate66.errors = vErrors;
  return errors === 0;
}
validate66.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
function validate68(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate68.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.review_deadline === void 0 || !func0.call(data, "review_deadline")) {
      const err0 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "review_deadline" }, message: "must have required property 'review_deadline'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.target_enforcement_at === void 0 || !func0.call(data, "target_enforcement_at")) {
      const err1 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "target_enforcement_at" }, message: "must have required property 'target_enforcement_at'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.review_deadline !== void 0 && func0.call(data, "review_deadline")) {
      let data0 = data.review_deadline;
      if (typeof data0 === "string") {
        if (!pattern6.test(data0)) {
          const err2 = { instancePath: instancePath + "/review_deadline", schemaPath: "#/$defs/Timestamp/pattern", keyword: "pattern", params: { pattern: "^[0-9]{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01])[Tt](?:[01][0-9]|2[0-3]):[0-5][0-9]:(?:[0-5][0-9]|60)(?:\\.[0-9]+)?(?:[Zz]|[+-](?:[01][0-9]|2[0-3]):[0-5][0-9])(?![\\s\\S])" }, message: 'must match pattern "^[0-9]{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01])[Tt](?:[01][0-9]|2[0-3]):[0-5][0-9]:(?:[0-5][0-9]|60)(?:\\.[0-9]+)?(?:[Zz]|[+-](?:[01][0-9]|2[0-3]):[0-5][0-9])(?![\\s\\S])"' };
          if (vErrors === null) {
            vErrors = [err2];
          } else {
            vErrors.push(err2);
          }
          errors++;
        }
        if (!formats0.validate(data0)) {
          const err3 = { instancePath: instancePath + "/review_deadline", schemaPath: "#/$defs/Timestamp/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' };
          if (vErrors === null) {
            vErrors = [err3];
          } else {
            vErrors.push(err3);
          }
          errors++;
        }
      } else {
        const err4 = { instancePath: instancePath + "/review_deadline", schemaPath: "#/$defs/Timestamp/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.target_enforcement_at !== void 0 && func0.call(data, "target_enforcement_at")) {
      let data1 = data.target_enforcement_at;
      if (typeof data1 === "string") {
        if (!pattern6.test(data1)) {
          const err5 = { instancePath: instancePath + "/target_enforcement_at", schemaPath: "#/$defs/Timestamp/pattern", keyword: "pattern", params: { pattern: "^[0-9]{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01])[Tt](?:[01][0-9]|2[0-3]):[0-5][0-9]:(?:[0-5][0-9]|60)(?:\\.[0-9]+)?(?:[Zz]|[+-](?:[01][0-9]|2[0-3]):[0-5][0-9])(?![\\s\\S])" }, message: 'must match pattern "^[0-9]{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01])[Tt](?:[01][0-9]|2[0-3]):[0-5][0-9]:(?:[0-5][0-9]|60)(?:\\.[0-9]+)?(?:[Zz]|[+-](?:[01][0-9]|2[0-3]):[0-5][0-9])(?![\\s\\S])"' };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        }
        if (!formats0.validate(data1)) {
          const err6 = { instancePath: instancePath + "/target_enforcement_at", schemaPath: "#/$defs/Timestamp/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' };
          if (vErrors === null) {
            vErrors = [err6];
          } else {
            vErrors.push(err6);
          }
          errors++;
        }
      } else {
        const err7 = { instancePath: instancePath + "/target_enforcement_at", schemaPath: "#/$defs/Timestamp/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
    }
    if (data.deprecation_at !== void 0 && func0.call(data, "deprecation_at")) {
      let data2 = data.deprecation_at;
      if (typeof data2 === "string") {
        if (!pattern6.test(data2)) {
          const err8 = { instancePath: instancePath + "/deprecation_at", schemaPath: "#/$defs/Timestamp/pattern", keyword: "pattern", params: { pattern: "^[0-9]{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01])[Tt](?:[01][0-9]|2[0-3]):[0-5][0-9]:(?:[0-5][0-9]|60)(?:\\.[0-9]+)?(?:[Zz]|[+-](?:[01][0-9]|2[0-3]):[0-5][0-9])(?![\\s\\S])" }, message: 'must match pattern "^[0-9]{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01])[Tt](?:[01][0-9]|2[0-3]):[0-5][0-9]:(?:[0-5][0-9]|60)(?:\\.[0-9]+)?(?:[Zz]|[+-](?:[01][0-9]|2[0-3]):[0-5][0-9])(?![\\s\\S])"' };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors++;
        }
        if (!formats0.validate(data2)) {
          const err9 = { instancePath: instancePath + "/deprecation_at", schemaPath: "#/$defs/Timestamp/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' };
          if (vErrors === null) {
            vErrors = [err9];
          } else {
            vErrors.push(err9);
          }
          errors++;
        }
      } else {
        const err10 = { instancePath: instancePath + "/deprecation_at", schemaPath: "#/$defs/Timestamp/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err10];
        } else {
          vErrors.push(err10);
        }
        errors++;
      }
    }
    if (data.removal_at !== void 0 && func0.call(data, "removal_at")) {
      let data3 = data.removal_at;
      if (typeof data3 === "string") {
        if (!pattern6.test(data3)) {
          const err11 = { instancePath: instancePath + "/removal_at", schemaPath: "#/$defs/Timestamp/pattern", keyword: "pattern", params: { pattern: "^[0-9]{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01])[Tt](?:[01][0-9]|2[0-3]):[0-5][0-9]:(?:[0-5][0-9]|60)(?:\\.[0-9]+)?(?:[Zz]|[+-](?:[01][0-9]|2[0-3]):[0-5][0-9])(?![\\s\\S])" }, message: 'must match pattern "^[0-9]{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01])[Tt](?:[01][0-9]|2[0-3]):[0-5][0-9]:(?:[0-5][0-9]|60)(?:\\.[0-9]+)?(?:[Zz]|[+-](?:[01][0-9]|2[0-3]):[0-5][0-9])(?![\\s\\S])"' };
          if (vErrors === null) {
            vErrors = [err11];
          } else {
            vErrors.push(err11);
          }
          errors++;
        }
        if (!formats0.validate(data3)) {
          const err12 = { instancePath: instancePath + "/removal_at", schemaPath: "#/$defs/Timestamp/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' };
          if (vErrors === null) {
            vErrors = [err12];
          } else {
            vErrors.push(err12);
          }
          errors++;
        }
      } else {
        const err13 = { instancePath: instancePath + "/removal_at", schemaPath: "#/$defs/Timestamp/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err13];
        } else {
          vErrors.push(err13);
        }
        errors++;
      }
    }
  } else {
    const err14 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err14];
    } else {
      vErrors.push(err14);
    }
    errors++;
  }
  validate68.errors = vErrors;
  return errors === 0;
}
validate68.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
function validate65(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate65.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.summary === void 0 || !func0.call(data, "summary")) {
      const err0 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "summary" }, message: "must have required property 'summary'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.rationale === void 0 || !func0.call(data, "rationale")) {
      const err1 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "rationale" }, message: "must have required property 'rationale'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.migration === void 0 || !func0.call(data, "migration")) {
      const err2 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "migration" }, message: "must have required property 'migration'" };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.timeline === void 0 || !func0.call(data, "timeline")) {
      const err3 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "timeline" }, message: "must have required property 'timeline'" };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.summary !== void 0 && func0.call(data, "summary")) {
      let data0 = data.summary;
      if (typeof data0 === "string") {
        if (func74(data0) > 200) {
          const err4 = { instancePath: instancePath + "/summary", schemaPath: "#/properties/summary/maxLength", keyword: "maxLength", params: { limit: 200 }, message: "must NOT have more than 200 characters" };
          if (vErrors === null) {
            vErrors = [err4];
          } else {
            vErrors.push(err4);
          }
          errors++;
        }
        if (func74(data0) < 1) {
          const err5 = { instancePath: instancePath + "/summary", schemaPath: "#/properties/summary/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        }
        if (!pattern7.test(data0)) {
          const err6 = { instancePath: instancePath + "/summary", schemaPath: "#/properties/summary/pattern", keyword: "pattern", params: { pattern: "^(?!\\s)[\\s\\S]*\\S(?![\\s\\S])" }, message: 'must match pattern "^(?!\\s)[\\s\\S]*\\S(?![\\s\\S])"' };
          if (vErrors === null) {
            vErrors = [err6];
          } else {
            vErrors.push(err6);
          }
          errors++;
        }
      } else {
        const err7 = { instancePath: instancePath + "/summary", schemaPath: "#/properties/summary/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
    }
    if (data.rationale !== void 0 && func0.call(data, "rationale")) {
      let data1 = data.rationale;
      if (typeof data1 === "string") {
        if (func74(data1) < 1) {
          const err8 = { instancePath: instancePath + "/rationale", schemaPath: "#/$defs/NonEmptyTrimmedString/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors++;
        }
        if (!pattern7.test(data1)) {
          const err9 = { instancePath: instancePath + "/rationale", schemaPath: "#/$defs/NonEmptyTrimmedString/pattern", keyword: "pattern", params: { pattern: "^(?!\\s)[\\s\\S]*\\S(?![\\s\\S])" }, message: 'must match pattern "^(?!\\s)[\\s\\S]*\\S(?![\\s\\S])"' };
          if (vErrors === null) {
            vErrors = [err9];
          } else {
            vErrors.push(err9);
          }
          errors++;
        }
      } else {
        const err10 = { instancePath: instancePath + "/rationale", schemaPath: "#/$defs/NonEmptyTrimmedString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err10];
        } else {
          vErrors.push(err10);
        }
        errors++;
      }
    }
    if (data.migration !== void 0 && func0.call(data, "migration")) {
      if (!validate66(data.migration, { instancePath: instancePath + "/migration", parentData: data, parentDataProperty: "migration", rootData, dynamicAnchors })) {
        vErrors = vErrors === null ? validate66.errors : vErrors.concat(validate66.errors);
        errors = vErrors.length;
      }
    }
    if (data.timeline !== void 0 && func0.call(data, "timeline")) {
      if (!validate68(data.timeline, { instancePath: instancePath + "/timeline", parentData: data, parentDataProperty: "timeline", rootData, dynamicAnchors })) {
        vErrors = vErrors === null ? validate68.errors : vErrors.concat(validate68.errors);
        errors = vErrors.length;
      }
    }
  } else {
    const err11 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err11];
    } else {
      vErrors.push(err11);
    }
    errors++;
  }
  validate65.errors = vErrors;
  return errors === 0;
}
validate65.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
function validate71(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate71.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  const _errs1 = errors;
  const _errs2 = errors;
  if (errors === _errs2) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if ((data.status === void 0 || !func0.call(data, "status")) && (missing0 = "status")) {
        const err0 = {};
        if (vErrors === null) {
          vErrors = [err0];
        } else {
          vErrors.push(err0);
        }
        errors++;
      }
    } else {
      const err1 = {};
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
  }
  var valid0 = _errs2 === errors;
  if (valid0) {
    const err2 = { instancePath, schemaPath: "#/not", keyword: "not", params: {}, message: "must NOT be valid" };
    if (vErrors === null) {
      vErrors = [err2];
    } else {
      vErrors.push(err2);
    }
    errors++;
  } else {
    errors = _errs1;
    if (vErrors !== null) {
      if (_errs1) {
        vErrors.length = _errs1;
      } else {
        vErrors = null;
      }
    }
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.team === void 0 || !func0.call(data, "team")) {
      const err3 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "team" }, message: "must have required property 'team'" };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.team !== void 0 && func0.call(data, "team")) {
      let data0 = data.team;
      if (typeof data0 === "string") {
        if (func74(data0) > 128) {
          const err4 = { instancePath: instancePath + "/team", schemaPath: "#/$defs/TeamId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" };
          if (vErrors === null) {
            vErrors = [err4];
          } else {
            vErrors.push(err4);
          }
          errors++;
        }
        if (func74(data0) < 1) {
          const err5 = { instancePath: instancePath + "/team", schemaPath: "#/$defs/TeamId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        }
        if (!pattern7.test(data0)) {
          const err6 = { instancePath: instancePath + "/team", schemaPath: "#/$defs/TeamId/pattern", keyword: "pattern", params: { pattern: "^(?!\\s)[\\s\\S]*\\S(?![\\s\\S])" }, message: 'must match pattern "^(?!\\s)[\\s\\S]*\\S(?![\\s\\S])"' };
          if (vErrors === null) {
            vErrors = [err6];
          } else {
            vErrors.push(err6);
          }
          errors++;
        }
      } else {
        const err7 = { instancePath: instancePath + "/team", schemaPath: "#/$defs/TeamId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
    }
    if (data.contact !== void 0 && func0.call(data, "contact")) {
      if (typeof data.contact !== "string") {
        const err8 = { instancePath: instancePath + "/contact", schemaPath: "#/properties/contact/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      }
    }
    if (data.dependencies !== void 0 && func0.call(data, "dependencies")) {
      let data2 = data.dependencies;
      if (Array.isArray(data2)) {
        const len0 = data2.length;
        for (let i0 = 0; i0 < len0; i0++) {
          if (typeof data2[i0] !== "string") {
            const err9 = { instancePath: instancePath + "/dependencies/" + i0, schemaPath: "#/$defs/DependencyList/items/type", keyword: "type", params: { type: "string" }, message: "must be string" };
            if (vErrors === null) {
              vErrors = [err9];
            } else {
              vErrors.push(err9);
            }
            errors++;
          }
        }
        let i1 = data2.length;
        let j0;
        if (i1 > 1) {
          const indices0 = {};
          for (; i1--; ) {
            let item0 = data2[i1];
            if (typeof item0 !== "string") {
              continue;
            }
            if (typeof indices0[item0] == "number") {
              j0 = indices0[item0];
              const err10 = { instancePath: instancePath + "/dependencies", schemaPath: "#/$defs/DependencyList/uniqueItems", keyword: "uniqueItems", params: { i: i1, j: j0 }, message: "must NOT have duplicate items (items ## " + j0 + " and " + i1 + " are identical)" };
              if (vErrors === null) {
                vErrors = [err10];
              } else {
                vErrors.push(err10);
              }
              errors++;
              break;
            }
            indices0[item0] = i1;
          }
        }
      } else {
        const err11 = { instancePath: instancePath + "/dependencies", schemaPath: "#/$defs/DependencyList/type", keyword: "type", params: { type: "array" }, message: "must be array" };
        if (vErrors === null) {
          vErrors = [err11];
        } else {
          vErrors.push(err11);
        }
        errors++;
      }
    }
  } else {
    const err12 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err12];
    } else {
      vErrors.push(err12);
    }
    errors++;
  }
  validate71.errors = vErrors;
  return errors === 0;
}
validate71.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var schema81 = { "title": "Consumer Response Decision", "type": "string", "enum": ["ACKNOWLEDGED", "OBJECTED", "EXTENSION_REQUESTED"] };
var pattern19 = new RegExp("^rsp_(?!.*(?:\\.\\.|[/\\\\]))[A-Za-z0-9_.-]+$", "u");
function validate73(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate73.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.response_id === void 0 || !func0.call(data, "response_id")) {
      const err0 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "response_id" }, message: "must have required property 'response_id'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.declaration_revision === void 0 || !func0.call(data, "declaration_revision")) {
      const err1 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "declaration_revision" }, message: "must have required property 'declaration_revision'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.team === void 0 || !func0.call(data, "team")) {
      const err2 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "team" }, message: "must have required property 'team'" };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.decision === void 0 || !func0.call(data, "decision")) {
      const err3 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "decision" }, message: "must have required property 'decision'" };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.message === void 0 || !func0.call(data, "message")) {
      const err4 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "message" }, message: "must have required property 'message'" };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    if (data.actor === void 0 || !func0.call(data, "actor")) {
      const err5 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "actor" }, message: "must have required property 'actor'" };
      if (vErrors === null) {
        vErrors = [err5];
      } else {
        vErrors.push(err5);
      }
      errors++;
    }
    if (data.at === void 0 || !func0.call(data, "at")) {
      const err6 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "at" }, message: "must have required property 'at'" };
      if (vErrors === null) {
        vErrors = [err6];
      } else {
        vErrors.push(err6);
      }
      errors++;
    }
    if (data.response_id !== void 0 && func0.call(data, "response_id")) {
      let data0 = data.response_id;
      if (typeof data0 === "string") {
        if (!pattern19.test(data0)) {
          const err7 = { instancePath: instancePath + "/response_id", schemaPath: "#/$defs/ResponseId/pattern", keyword: "pattern", params: { pattern: "^rsp_(?!.*(?:\\.\\.|[/\\\\]))[A-Za-z0-9_.-]+$" }, message: 'must match pattern "^rsp_(?!.*(?:\\.\\.|[/\\\\]))[A-Za-z0-9_.-]+$"' };
          if (vErrors === null) {
            vErrors = [err7];
          } else {
            vErrors.push(err7);
          }
          errors++;
        }
      } else {
        const err8 = { instancePath: instancePath + "/response_id", schemaPath: "#/$defs/ResponseId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      }
    }
    if (data.declaration_revision !== void 0 && func0.call(data, "declaration_revision")) {
      let data1 = data.declaration_revision;
      if (!(typeof data1 == "number" && (!(data1 % 1) && !isNaN(data1)) && isFinite(data1))) {
        const err9 = { instancePath: instancePath + "/declaration_revision", schemaPath: "#/$defs/Revision/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
      if (typeof data1 == "number" && isFinite(data1)) {
        if (data1 < 1 || isNaN(data1)) {
          const err10 = { instancePath: instancePath + "/declaration_revision", schemaPath: "#/$defs/Revision/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" };
          if (vErrors === null) {
            vErrors = [err10];
          } else {
            vErrors.push(err10);
          }
          errors++;
        }
      }
    }
    if (data.team !== void 0 && func0.call(data, "team")) {
      let data2 = data.team;
      if (typeof data2 === "string") {
        if (func74(data2) > 128) {
          const err11 = { instancePath: instancePath + "/team", schemaPath: "#/$defs/TeamId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" };
          if (vErrors === null) {
            vErrors = [err11];
          } else {
            vErrors.push(err11);
          }
          errors++;
        }
        if (func74(data2) < 1) {
          const err12 = { instancePath: instancePath + "/team", schemaPath: "#/$defs/TeamId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err12];
          } else {
            vErrors.push(err12);
          }
          errors++;
        }
        if (!pattern7.test(data2)) {
          const err13 = { instancePath: instancePath + "/team", schemaPath: "#/$defs/TeamId/pattern", keyword: "pattern", params: { pattern: "^(?!\\s)[\\s\\S]*\\S(?![\\s\\S])" }, message: 'must match pattern "^(?!\\s)[\\s\\S]*\\S(?![\\s\\S])"' };
          if (vErrors === null) {
            vErrors = [err13];
          } else {
            vErrors.push(err13);
          }
          errors++;
        }
      } else {
        const err14 = { instancePath: instancePath + "/team", schemaPath: "#/$defs/TeamId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err14];
        } else {
          vErrors.push(err14);
        }
        errors++;
      }
    }
    if (data.decision !== void 0 && func0.call(data, "decision")) {
      let data3 = data.decision;
      if (typeof data3 !== "string") {
        const err15 = { instancePath: instancePath + "/decision", schemaPath: "#/$defs/ResponseDecision/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err15];
        } else {
          vErrors.push(err15);
        }
        errors++;
      }
      if (!(data3 === "ACKNOWLEDGED" || data3 === "OBJECTED" || data3 === "EXTENSION_REQUESTED")) {
        const err16 = { instancePath: instancePath + "/decision", schemaPath: "#/$defs/ResponseDecision/enum", keyword: "enum", params: { allowedValues: schema81.enum }, message: "must be equal to one of the allowed values" };
        if (vErrors === null) {
          vErrors = [err16];
        } else {
          vErrors.push(err16);
        }
        errors++;
      }
    }
    if (data.message !== void 0 && func0.call(data, "message")) {
      if (typeof data.message !== "string") {
        const err17 = { instancePath: instancePath + "/message", schemaPath: "#/properties/message/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err17];
        } else {
          vErrors.push(err17);
        }
        errors++;
      }
    }
    if (data.actor !== void 0 && func0.call(data, "actor")) {
      if (typeof data.actor !== "string") {
        const err18 = { instancePath: instancePath + "/actor", schemaPath: "#/properties/actor/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err18];
        } else {
          vErrors.push(err18);
        }
        errors++;
      }
    }
    if (data.at !== void 0 && func0.call(data, "at")) {
      let data6 = data.at;
      if (typeof data6 === "string") {
        if (!pattern6.test(data6)) {
          const err19 = { instancePath: instancePath + "/at", schemaPath: "#/$defs/Timestamp/pattern", keyword: "pattern", params: { pattern: "^[0-9]{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01])[Tt](?:[01][0-9]|2[0-3]):[0-5][0-9]:(?:[0-5][0-9]|60)(?:\\.[0-9]+)?(?:[Zz]|[+-](?:[01][0-9]|2[0-3]):[0-5][0-9])(?![\\s\\S])" }, message: 'must match pattern "^[0-9]{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01])[Tt](?:[01][0-9]|2[0-3]):[0-5][0-9]:(?:[0-5][0-9]|60)(?:\\.[0-9]+)?(?:[Zz]|[+-](?:[01][0-9]|2[0-3]):[0-5][0-9])(?![\\s\\S])"' };
          if (vErrors === null) {
            vErrors = [err19];
          } else {
            vErrors.push(err19);
          }
          errors++;
        }
        if (!formats0.validate(data6)) {
          const err20 = { instancePath: instancePath + "/at", schemaPath: "#/$defs/Timestamp/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' };
          if (vErrors === null) {
            vErrors = [err20];
          } else {
            vErrors.push(err20);
          }
          errors++;
        }
      } else {
        const err21 = { instancePath: instancePath + "/at", schemaPath: "#/$defs/Timestamp/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err21];
        } else {
          vErrors.push(err21);
        }
        errors++;
      }
    }
  } else {
    const err22 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err22];
    } else {
      vErrors.push(err22);
    }
    errors++;
  }
  validate73.errors = vErrors;
  return errors === 0;
}
validate73.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var schema91 = { "title": "Evidence Result", "type": "string", "enum": ["PASSED", "FAILED"] };
var pattern22 = new RegExp("^evd_(?!.*(?:\\.\\.|[/\\\\]))[A-Za-z0-9_.-]+$", "u");
var pattern26 = new RegExp("^[0-9a-f]{64}$", "u");
function validate76(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate76.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    for (const key0 of Object.keys(data)) {
      let data0 = data[key0];
      if (typeof data0 === "string") {
        if (!pattern26.test(data0)) {
          const err0 = { instancePath: instancePath + "/" + key0.replace(/~/g, "~0").replace(/\//g, "~1"), schemaPath: "#/$defs/Sha256Digest/pattern", keyword: "pattern", params: { pattern: "^[0-9a-f]{64}$" }, message: 'must match pattern "^[0-9a-f]{64}$"' };
          if (vErrors === null) {
            vErrors = [err0];
          } else {
            vErrors.push(err0);
          }
          errors++;
        }
      } else {
        const err1 = { instancePath: instancePath + "/" + key0.replace(/~/g, "~0").replace(/\//g, "~1"), schemaPath: "#/$defs/Sha256Digest/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err1];
        } else {
          vErrors.push(err1);
        }
        errors++;
      }
    }
  } else {
    const err2 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err2];
    } else {
      vErrors.push(err2);
    }
    errors++;
  }
  validate76.errors = vErrors;
  return errors === 0;
}
validate76.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var pattern28 = new RegExp("[?&](?:[Aa][Cc][Cc][Ee][Ss][Ss][_-]?[Tt][Oo][Kk][Ee][Nn]|[Aa][Pp][Ii][_-]?[Kk][Ee][Yy]|[Cc][Rr][Ee][Dd][Ee][Nn][Tt][Ii][Aa][Ll]|[Pp][Aa][Ss][Ss](?:[Ww][Oo][Rr][Dd]|[Ww][Dd])?|[Ss][Ee][Cc][Rr][Ee][Tt]|[Tt][Oo][Kk][Ee][Nn])=", "u");
var pattern29 = new RegExp("^(?:https://(?![^/?#]*@)[^\\s/?#@]+(?:[/?#][^\\s]*)?|urn:[A-Za-z0-9][A-Za-z0-9-]{0,31}:[^\\s]+)$", "u");
var formats14 = require_formats().fullFormats.uri;
function validate78(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate78.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.uri === void 0 || !func0.call(data, "uri")) {
      const err0 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "uri" }, message: "must have required property 'uri'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.sha256 === void 0 || !func0.call(data, "sha256")) {
      const err1 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "sha256" }, message: "must have required property 'sha256'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.uri !== void 0 && func0.call(data, "uri")) {
      let data0 = data.uri;
      const _errs5 = errors;
      const _errs6 = errors;
      if (typeof data0 === "string") {
        if (!pattern28.test(data0)) {
          const err2 = {};
          if (vErrors === null) {
            vErrors = [err2];
          } else {
            vErrors.push(err2);
          }
          errors++;
        }
      }
      var valid2 = _errs6 === errors;
      if (valid2) {
        const err3 = { instancePath: instancePath + "/uri", schemaPath: "#/$defs/ArtifactUri/not", keyword: "not", params: {}, message: "must NOT be valid" };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      } else {
        errors = _errs5;
        if (vErrors !== null) {
          if (_errs5) {
            vErrors.length = _errs5;
          } else {
            vErrors = null;
          }
        }
      }
      if (typeof data0 === "string") {
        if (!pattern29.test(data0)) {
          const err4 = { instancePath: instancePath + "/uri", schemaPath: "#/$defs/ArtifactUri/pattern", keyword: "pattern", params: { pattern: "^(?:https://(?![^/?#]*@)[^\\s/?#@]+(?:[/?#][^\\s]*)?|urn:[A-Za-z0-9][A-Za-z0-9-]{0,31}:[^\\s]+)$" }, message: 'must match pattern "^(?:https://(?![^/?#]*@)[^\\s/?#@]+(?:[/?#][^\\s]*)?|urn:[A-Za-z0-9][A-Za-z0-9-]{0,31}:[^\\s]+)$"' };
          if (vErrors === null) {
            vErrors = [err4];
          } else {
            vErrors.push(err4);
          }
          errors++;
        }
        if (!formats14(data0)) {
          const err5 = { instancePath: instancePath + "/uri", schemaPath: "#/$defs/ArtifactUri/format", keyword: "format", params: { format: "uri" }, message: 'must match format "uri"' };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        }
      } else {
        const err6 = { instancePath: instancePath + "/uri", schemaPath: "#/$defs/ArtifactUri/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
    if (data.sha256 !== void 0 && func0.call(data, "sha256")) {
      let data1 = data.sha256;
      if (typeof data1 === "string") {
        if (!pattern26.test(data1)) {
          const err7 = { instancePath: instancePath + "/sha256", schemaPath: "#/$defs/Sha256Digest/pattern", keyword: "pattern", params: { pattern: "^[0-9a-f]{64}$" }, message: 'must match pattern "^[0-9a-f]{64}$"' };
          if (vErrors === null) {
            vErrors = [err7];
          } else {
            vErrors.push(err7);
          }
          errors++;
        }
      } else {
        const err8 = { instancePath: instancePath + "/sha256", schemaPath: "#/$defs/Sha256Digest/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      }
    }
  } else {
    const err9 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err9];
    } else {
      vErrors.push(err9);
    }
    errors++;
  }
  validate78.errors = vErrors;
  return errors === 0;
}
validate78.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
function validate75(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate75.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.evidence_id === void 0 || !func0.call(data, "evidence_id")) {
      const err0 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "evidence_id" }, message: "must have required property 'evidence_id'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.declaration_revision === void 0 || !func0.call(data, "declaration_revision")) {
      const err1 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "declaration_revision" }, message: "must have required property 'declaration_revision'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.team === void 0 || !func0.call(data, "team")) {
      const err2 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "team" }, message: "must have required property 'team'" };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.validator_id === void 0 || !func0.call(data, "validator_id")) {
      const err3 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "validator_id" }, message: "must have required property 'validator_id'" };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.change_ids === void 0 || !func0.call(data, "change_ids")) {
      const err4 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "change_ids" }, message: "must have required property 'change_ids'" };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    if (data.source_digests === void 0 || !func0.call(data, "source_digests")) {
      const err5 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "source_digests" }, message: "must have required property 'source_digests'" };
      if (vErrors === null) {
        vErrors = [err5];
      } else {
        vErrors.push(err5);
      }
      errors++;
    }
    if (data.result === void 0 || !func0.call(data, "result")) {
      const err6 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "result" }, message: "must have required property 'result'" };
      if (vErrors === null) {
        vErrors = [err6];
      } else {
        vErrors.push(err6);
      }
      errors++;
    }
    if (data.at === void 0 || !func0.call(data, "at")) {
      const err7 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "at" }, message: "must have required property 'at'" };
      if (vErrors === null) {
        vErrors = [err7];
      } else {
        vErrors.push(err7);
      }
      errors++;
    }
    if (data.summary === void 0 || !func0.call(data, "summary")) {
      const err8 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "summary" }, message: "must have required property 'summary'" };
      if (vErrors === null) {
        vErrors = [err8];
      } else {
        vErrors.push(err8);
      }
      errors++;
    }
    if (data.evidence_id !== void 0 && func0.call(data, "evidence_id")) {
      let data0 = data.evidence_id;
      if (typeof data0 === "string") {
        if (!pattern22.test(data0)) {
          const err9 = { instancePath: instancePath + "/evidence_id", schemaPath: "#/$defs/EvidenceId/pattern", keyword: "pattern", params: { pattern: "^evd_(?!.*(?:\\.\\.|[/\\\\]))[A-Za-z0-9_.-]+$" }, message: 'must match pattern "^evd_(?!.*(?:\\.\\.|[/\\\\]))[A-Za-z0-9_.-]+$"' };
          if (vErrors === null) {
            vErrors = [err9];
          } else {
            vErrors.push(err9);
          }
          errors++;
        }
      } else {
        const err10 = { instancePath: instancePath + "/evidence_id", schemaPath: "#/$defs/EvidenceId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err10];
        } else {
          vErrors.push(err10);
        }
        errors++;
      }
    }
    if (data.declaration_revision !== void 0 && func0.call(data, "declaration_revision")) {
      let data1 = data.declaration_revision;
      if (!(typeof data1 == "number" && (!(data1 % 1) && !isNaN(data1)) && isFinite(data1))) {
        const err11 = { instancePath: instancePath + "/declaration_revision", schemaPath: "#/$defs/Revision/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
        if (vErrors === null) {
          vErrors = [err11];
        } else {
          vErrors.push(err11);
        }
        errors++;
      }
      if (typeof data1 == "number" && isFinite(data1)) {
        if (data1 < 1 || isNaN(data1)) {
          const err12 = { instancePath: instancePath + "/declaration_revision", schemaPath: "#/$defs/Revision/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" };
          if (vErrors === null) {
            vErrors = [err12];
          } else {
            vErrors.push(err12);
          }
          errors++;
        }
      }
    }
    if (data.team !== void 0 && func0.call(data, "team")) {
      let data2 = data.team;
      if (typeof data2 === "string") {
        if (func74(data2) > 128) {
          const err13 = { instancePath: instancePath + "/team", schemaPath: "#/$defs/TeamId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" };
          if (vErrors === null) {
            vErrors = [err13];
          } else {
            vErrors.push(err13);
          }
          errors++;
        }
        if (func74(data2) < 1) {
          const err14 = { instancePath: instancePath + "/team", schemaPath: "#/$defs/TeamId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err14];
          } else {
            vErrors.push(err14);
          }
          errors++;
        }
        if (!pattern7.test(data2)) {
          const err15 = { instancePath: instancePath + "/team", schemaPath: "#/$defs/TeamId/pattern", keyword: "pattern", params: { pattern: "^(?!\\s)[\\s\\S]*\\S(?![\\s\\S])" }, message: 'must match pattern "^(?!\\s)[\\s\\S]*\\S(?![\\s\\S])"' };
          if (vErrors === null) {
            vErrors = [err15];
          } else {
            vErrors.push(err15);
          }
          errors++;
        }
      } else {
        const err16 = { instancePath: instancePath + "/team", schemaPath: "#/$defs/TeamId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err16];
        } else {
          vErrors.push(err16);
        }
        errors++;
      }
    }
    if (data.validator_id !== void 0 && func0.call(data, "validator_id")) {
      let data3 = data.validator_id;
      if (typeof data3 === "string") {
        if (func74(data3) > 128) {
          const err17 = { instancePath: instancePath + "/validator_id", schemaPath: "#/$defs/ValidatorId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" };
          if (vErrors === null) {
            vErrors = [err17];
          } else {
            vErrors.push(err17);
          }
          errors++;
        }
        if (func74(data3) < 1) {
          const err18 = { instancePath: instancePath + "/validator_id", schemaPath: "#/$defs/ValidatorId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err18];
          } else {
            vErrors.push(err18);
          }
          errors++;
        }
        if (!pattern7.test(data3)) {
          const err19 = { instancePath: instancePath + "/validator_id", schemaPath: "#/$defs/ValidatorId/pattern", keyword: "pattern", params: { pattern: "^(?!\\s)[\\s\\S]*\\S(?![\\s\\S])" }, message: 'must match pattern "^(?!\\s)[\\s\\S]*\\S(?![\\s\\S])"' };
          if (vErrors === null) {
            vErrors = [err19];
          } else {
            vErrors.push(err19);
          }
          errors++;
        }
      } else {
        const err20 = { instancePath: instancePath + "/validator_id", schemaPath: "#/$defs/ValidatorId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err20];
        } else {
          vErrors.push(err20);
        }
        errors++;
      }
    }
    if (data.validator_version !== void 0 && func0.call(data, "validator_version")) {
      if (typeof data.validator_version !== "string") {
        const err21 = { instancePath: instancePath + "/validator_version", schemaPath: "#/properties/validator_version/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err21];
        } else {
          vErrors.push(err21);
        }
        errors++;
      }
    }
    if (data.change_ids !== void 0 && func0.call(data, "change_ids")) {
      let data5 = data.change_ids;
      if (Array.isArray(data5)) {
        if (data5.length < 1) {
          const err22 = { instancePath: instancePath + "/change_ids", schemaPath: "#/properties/change_ids/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" };
          if (vErrors === null) {
            vErrors = [err22];
          } else {
            vErrors.push(err22);
          }
          errors++;
        }
        const len0 = data5.length;
        for (let i0 = 0; i0 < len0; i0++) {
          let data6 = data5[i0];
          if (typeof data6 === "string") {
            if (!pattern8.test(data6)) {
              const err23 = { instancePath: instancePath + "/change_ids/" + i0, schemaPath: "#/$defs/ChangeId/pattern", keyword: "pattern", params: { pattern: "^chg_sha256_[0-9a-f]{64}$" }, message: 'must match pattern "^chg_sha256_[0-9a-f]{64}$"' };
              if (vErrors === null) {
                vErrors = [err23];
              } else {
                vErrors.push(err23);
              }
              errors++;
            }
          } else {
            const err24 = { instancePath: instancePath + "/change_ids/" + i0, schemaPath: "#/$defs/ChangeId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
            if (vErrors === null) {
              vErrors = [err24];
            } else {
              vErrors.push(err24);
            }
            errors++;
          }
        }
        let i1 = data5.length;
        let j0;
        if (i1 > 1) {
          outer0: for (; i1--; ) {
            for (j0 = i1; j0--; ) {
              if (func27(data5[i1], data5[j0])) {
                const err25 = { instancePath: instancePath + "/change_ids", schemaPath: "#/properties/change_ids/uniqueItems", keyword: "uniqueItems", params: { i: i1, j: j0 }, message: "must NOT have duplicate items (items ## " + j0 + " and " + i1 + " are identical)" };
                if (vErrors === null) {
                  vErrors = [err25];
                } else {
                  vErrors.push(err25);
                }
                errors++;
                break outer0;
              }
            }
          }
        }
      } else {
        const err26 = { instancePath: instancePath + "/change_ids", schemaPath: "#/properties/change_ids/type", keyword: "type", params: { type: "array" }, message: "must be array" };
        if (vErrors === null) {
          vErrors = [err26];
        } else {
          vErrors.push(err26);
        }
        errors++;
      }
    }
    if (data.source_digests !== void 0 && func0.call(data, "source_digests")) {
      if (!validate76(data.source_digests, { instancePath: instancePath + "/source_digests", parentData: data, parentDataProperty: "source_digests", rootData, dynamicAnchors })) {
        vErrors = vErrors === null ? validate76.errors : vErrors.concat(validate76.errors);
        errors = vErrors.length;
      }
    }
    if (data.result !== void 0 && func0.call(data, "result")) {
      let data8 = data.result;
      if (typeof data8 !== "string") {
        const err27 = { instancePath: instancePath + "/result", schemaPath: "#/$defs/EvidenceResult/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err27];
        } else {
          vErrors.push(err27);
        }
        errors++;
      }
      if (!(data8 === "PASSED" || data8 === "FAILED")) {
        const err28 = { instancePath: instancePath + "/result", schemaPath: "#/$defs/EvidenceResult/enum", keyword: "enum", params: { allowedValues: schema91.enum }, message: "must be equal to one of the allowed values" };
        if (vErrors === null) {
          vErrors = [err28];
        } else {
          vErrors.push(err28);
        }
        errors++;
      }
    }
    if (data.at !== void 0 && func0.call(data, "at")) {
      let data9 = data.at;
      if (typeof data9 === "string") {
        if (!pattern6.test(data9)) {
          const err29 = { instancePath: instancePath + "/at", schemaPath: "#/$defs/Timestamp/pattern", keyword: "pattern", params: { pattern: "^[0-9]{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01])[Tt](?:[01][0-9]|2[0-3]):[0-5][0-9]:(?:[0-5][0-9]|60)(?:\\.[0-9]+)?(?:[Zz]|[+-](?:[01][0-9]|2[0-3]):[0-5][0-9])(?![\\s\\S])" }, message: 'must match pattern "^[0-9]{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01])[Tt](?:[01][0-9]|2[0-3]):[0-5][0-9]:(?:[0-5][0-9]|60)(?:\\.[0-9]+)?(?:[Zz]|[+-](?:[01][0-9]|2[0-3]):[0-5][0-9])(?![\\s\\S])"' };
          if (vErrors === null) {
            vErrors = [err29];
          } else {
            vErrors.push(err29);
          }
          errors++;
        }
        if (!formats0.validate(data9)) {
          const err30 = { instancePath: instancePath + "/at", schemaPath: "#/$defs/Timestamp/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' };
          if (vErrors === null) {
            vErrors = [err30];
          } else {
            vErrors.push(err30);
          }
          errors++;
        }
      } else {
        const err31 = { instancePath: instancePath + "/at", schemaPath: "#/$defs/Timestamp/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err31];
        } else {
          vErrors.push(err31);
        }
        errors++;
      }
    }
    if (data.summary !== void 0 && func0.call(data, "summary")) {
      let data10 = data.summary;
      if (typeof data10 === "string") {
        if (func74(data10) > 1024) {
          const err32 = { instancePath: instancePath + "/summary", schemaPath: "#/properties/summary/maxLength", keyword: "maxLength", params: { limit: 1024 }, message: "must NOT have more than 1024 characters" };
          if (vErrors === null) {
            vErrors = [err32];
          } else {
            vErrors.push(err32);
          }
          errors++;
        }
      } else {
        const err33 = { instancePath: instancePath + "/summary", schemaPath: "#/properties/summary/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err33];
        } else {
          vErrors.push(err33);
        }
        errors++;
      }
    }
    if (data.artifact !== void 0 && func0.call(data, "artifact")) {
      if (!validate78(data.artifact, { instancePath: instancePath + "/artifact", parentData: data, parentDataProperty: "artifact", rootData, dynamicAnchors })) {
        vErrors = vErrors === null ? validate78.errors : vErrors.concat(validate78.errors);
        errors = vErrors.length;
      }
    }
  } else {
    const err34 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err34];
    } else {
      vErrors.push(err34);
    }
    errors++;
  }
  validate75.errors = vErrors;
  return errors === 0;
}
validate75.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var schema100 = { "title": "Lifecycle Event Type", "type": "string", "enum": ["CREATED", "DECLARATION_UPDATED", "PROPOSED", "CONSUMER_RESPONDED", "EVIDENCE_RECORDED", "ACCEPTED", "ENFORCING", "COMPLETED", "WITHDRAWN", "REJECTED"] };
var pattern31 = new RegExp("^evt_(?!.*(?:\\.\\.|[/\\\\]))[A-Za-z0-9_.-]+$", "u");
function validate83(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate83.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.event_id === void 0 || !func0.call(data, "event_id")) {
      const err0 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "event_id" }, message: "must have required property 'event_id'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.type === void 0 || !func0.call(data, "type")) {
      const err1 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "type" }, message: "must have required property 'type'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.declaration_revision === void 0 || !func0.call(data, "declaration_revision")) {
      const err2 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "declaration_revision" }, message: "must have required property 'declaration_revision'" };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.at === void 0 || !func0.call(data, "at")) {
      const err3 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "at" }, message: "must have required property 'at'" };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.actor === void 0 || !func0.call(data, "actor")) {
      const err4 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "actor" }, message: "must have required property 'actor'" };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    if (data.from_status === void 0 || !func0.call(data, "from_status")) {
      const err5 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "from_status" }, message: "must have required property 'from_status'" };
      if (vErrors === null) {
        vErrors = [err5];
      } else {
        vErrors.push(err5);
      }
      errors++;
    }
    if (data.to_status === void 0 || !func0.call(data, "to_status")) {
      const err6 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "to_status" }, message: "must have required property 'to_status'" };
      if (vErrors === null) {
        vErrors = [err6];
      } else {
        vErrors.push(err6);
      }
      errors++;
    }
    if (data.event_id !== void 0 && func0.call(data, "event_id")) {
      let data0 = data.event_id;
      if (typeof data0 === "string") {
        if (!pattern31.test(data0)) {
          const err7 = { instancePath: instancePath + "/event_id", schemaPath: "#/$defs/EventId/pattern", keyword: "pattern", params: { pattern: "^evt_(?!.*(?:\\.\\.|[/\\\\]))[A-Za-z0-9_.-]+$" }, message: 'must match pattern "^evt_(?!.*(?:\\.\\.|[/\\\\]))[A-Za-z0-9_.-]+$"' };
          if (vErrors === null) {
            vErrors = [err7];
          } else {
            vErrors.push(err7);
          }
          errors++;
        }
      } else {
        const err8 = { instancePath: instancePath + "/event_id", schemaPath: "#/$defs/EventId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      }
    }
    if (data.type !== void 0 && func0.call(data, "type")) {
      let data1 = data.type;
      if (typeof data1 !== "string") {
        const err9 = { instancePath: instancePath + "/type", schemaPath: "#/$defs/EventType/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
      if (!(data1 === "CREATED" || data1 === "DECLARATION_UPDATED" || data1 === "PROPOSED" || data1 === "CONSUMER_RESPONDED" || data1 === "EVIDENCE_RECORDED" || data1 === "ACCEPTED" || data1 === "ENFORCING" || data1 === "COMPLETED" || data1 === "WITHDRAWN" || data1 === "REJECTED")) {
        const err10 = { instancePath: instancePath + "/type", schemaPath: "#/$defs/EventType/enum", keyword: "enum", params: { allowedValues: schema100.enum }, message: "must be equal to one of the allowed values" };
        if (vErrors === null) {
          vErrors = [err10];
        } else {
          vErrors.push(err10);
        }
        errors++;
      }
    }
    if (data.declaration_revision !== void 0 && func0.call(data, "declaration_revision")) {
      let data2 = data.declaration_revision;
      if (!(typeof data2 == "number" && (!(data2 % 1) && !isNaN(data2)) && isFinite(data2))) {
        const err11 = { instancePath: instancePath + "/declaration_revision", schemaPath: "#/$defs/Revision/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
        if (vErrors === null) {
          vErrors = [err11];
        } else {
          vErrors.push(err11);
        }
        errors++;
      }
      if (typeof data2 == "number" && isFinite(data2)) {
        if (data2 < 1 || isNaN(data2)) {
          const err12 = { instancePath: instancePath + "/declaration_revision", schemaPath: "#/$defs/Revision/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" };
          if (vErrors === null) {
            vErrors = [err12];
          } else {
            vErrors.push(err12);
          }
          errors++;
        }
      }
    }
    if (data.at !== void 0 && func0.call(data, "at")) {
      let data3 = data.at;
      if (typeof data3 === "string") {
        if (!pattern6.test(data3)) {
          const err13 = { instancePath: instancePath + "/at", schemaPath: "#/$defs/Timestamp/pattern", keyword: "pattern", params: { pattern: "^[0-9]{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01])[Tt](?:[01][0-9]|2[0-3]):[0-5][0-9]:(?:[0-5][0-9]|60)(?:\\.[0-9]+)?(?:[Zz]|[+-](?:[01][0-9]|2[0-3]):[0-5][0-9])(?![\\s\\S])" }, message: 'must match pattern "^[0-9]{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01])[Tt](?:[01][0-9]|2[0-3]):[0-5][0-9]:(?:[0-5][0-9]|60)(?:\\.[0-9]+)?(?:[Zz]|[+-](?:[01][0-9]|2[0-3]):[0-5][0-9])(?![\\s\\S])"' };
          if (vErrors === null) {
            vErrors = [err13];
          } else {
            vErrors.push(err13);
          }
          errors++;
        }
        if (!formats0.validate(data3)) {
          const err14 = { instancePath: instancePath + "/at", schemaPath: "#/$defs/Timestamp/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' };
          if (vErrors === null) {
            vErrors = [err14];
          } else {
            vErrors.push(err14);
          }
          errors++;
        }
      } else {
        const err15 = { instancePath: instancePath + "/at", schemaPath: "#/$defs/Timestamp/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err15];
        } else {
          vErrors.push(err15);
        }
        errors++;
      }
    }
    if (data.actor !== void 0 && func0.call(data, "actor")) {
      if (typeof data.actor !== "string") {
        const err16 = { instancePath: instancePath + "/actor", schemaPath: "#/properties/actor/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err16];
        } else {
          vErrors.push(err16);
        }
        errors++;
      }
    }
    if (data.from_status !== void 0 && func0.call(data, "from_status")) {
      let data5 = data.from_status;
      const _errs17 = errors;
      let valid5 = false;
      const _errs18 = errors;
      if (typeof data5 !== "string") {
        const err17 = { instancePath: instancePath + "/from_status", schemaPath: "#/$defs/Status/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err17];
        } else {
          vErrors.push(err17);
        }
        errors++;
      }
      if (!(data5 === "DRAFT" || data5 === "PROPOSED" || data5 === "UNDER_REVIEW" || data5 === "ACCEPTED" || data5 === "ENFORCING" || data5 === "COMPLETED" || data5 === "WITHDRAWN" || data5 === "REJECTED")) {
        const err18 = { instancePath: instancePath + "/from_status", schemaPath: "#/$defs/Status/enum", keyword: "enum", params: { allowedValues: schema36.enum }, message: "must be equal to one of the allowed values" };
        if (vErrors === null) {
          vErrors = [err18];
        } else {
          vErrors.push(err18);
        }
        errors++;
      }
      var _valid0 = _errs18 === errors;
      valid5 = valid5 || _valid0;
      const _errs21 = errors;
      if (data5 !== null) {
        const err19 = { instancePath: instancePath + "/from_status", schemaPath: "#/properties/from_status/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
        if (vErrors === null) {
          vErrors = [err19];
        } else {
          vErrors.push(err19);
        }
        errors++;
      }
      var _valid0 = _errs21 === errors;
      valid5 = valid5 || _valid0;
      if (!valid5) {
        const err20 = { instancePath: instancePath + "/from_status", schemaPath: "#/properties/from_status/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
        if (vErrors === null) {
          vErrors = [err20];
        } else {
          vErrors.push(err20);
        }
        errors++;
      } else {
        errors = _errs17;
        if (vErrors !== null) {
          if (_errs17) {
            vErrors.length = _errs17;
          } else {
            vErrors = null;
          }
        }
      }
    }
    if (data.to_status !== void 0 && func0.call(data, "to_status")) {
      let data6 = data.to_status;
      const _errs24 = errors;
      let valid7 = false;
      const _errs25 = errors;
      if (typeof data6 !== "string") {
        const err21 = { instancePath: instancePath + "/to_status", schemaPath: "#/$defs/Status/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err21];
        } else {
          vErrors.push(err21);
        }
        errors++;
      }
      if (!(data6 === "DRAFT" || data6 === "PROPOSED" || data6 === "UNDER_REVIEW" || data6 === "ACCEPTED" || data6 === "ENFORCING" || data6 === "COMPLETED" || data6 === "WITHDRAWN" || data6 === "REJECTED")) {
        const err22 = { instancePath: instancePath + "/to_status", schemaPath: "#/$defs/Status/enum", keyword: "enum", params: { allowedValues: schema36.enum }, message: "must be equal to one of the allowed values" };
        if (vErrors === null) {
          vErrors = [err22];
        } else {
          vErrors.push(err22);
        }
        errors++;
      }
      var _valid1 = _errs25 === errors;
      valid7 = valid7 || _valid1;
      const _errs28 = errors;
      if (data6 !== null) {
        const err23 = { instancePath: instancePath + "/to_status", schemaPath: "#/properties/to_status/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
        if (vErrors === null) {
          vErrors = [err23];
        } else {
          vErrors.push(err23);
        }
        errors++;
      }
      var _valid1 = _errs28 === errors;
      valid7 = valid7 || _valid1;
      if (!valid7) {
        const err24 = { instancePath: instancePath + "/to_status", schemaPath: "#/properties/to_status/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
        if (vErrors === null) {
          vErrors = [err24];
        } else {
          vErrors.push(err24);
        }
        errors++;
      } else {
        errors = _errs24;
        if (vErrors !== null) {
          if (_errs24) {
            vErrors.length = _errs24;
          } else {
            vErrors = null;
          }
        }
      }
    }
    if (data.details !== void 0 && func0.call(data, "details")) {
      let data7 = data.details;
      if (!(data7 && typeof data7 == "object" && !Array.isArray(data7))) {
        const err25 = { instancePath: instancePath + "/details", schemaPath: "#/properties/details/type", keyword: "type", params: { type: "object" }, message: "must be object" };
        if (vErrors === null) {
          vErrors = [err25];
        } else {
          vErrors.push(err25);
        }
        errors++;
      }
    }
  } else {
    const err26 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err26];
    } else {
      vErrors.push(err26);
    }
    errors++;
  }
  validate83.errors = vErrors;
  return errors === 0;
}
validate83.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
function validate82(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate82.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (!validate83(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
    vErrors = vErrors === null ? validate83.errors : vErrors.concat(validate83.errors);
    errors = vErrors.length;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.type === void 0 || !func0.call(data, "type")) {
      const err0 = { instancePath, schemaPath: "#/allOf/1/required", keyword: "required", params: { missingProperty: "type" }, message: "must have required property 'type'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.type !== void 0 && func0.call(data, "type")) {
      if ("CREATED" !== data.type) {
        const err1 = { instancePath: instancePath + "/type", schemaPath: "#/allOf/1/properties/type/const", keyword: "const", params: { allowedValue: "CREATED" }, message: "must be equal to constant" };
        if (vErrors === null) {
          vErrors = [err1];
        } else {
          vErrors.push(err1);
        }
        errors++;
      }
    }
    if (data.details !== void 0 && func0.call(data, "details")) {
      let data1 = data.details;
      if (data1 && typeof data1 == "object" && !Array.isArray(data1)) {
      } else {
        const err2 = { instancePath: instancePath + "/details", schemaPath: "#/$defs/EmptyEventDetails/type", keyword: "type", params: { type: "object" }, message: "must be object" };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
  } else {
    const err3 = { instancePath, schemaPath: "#/allOf/1/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err3];
    } else {
      vErrors.push(err3);
    }
    errors++;
  }
  validate82.errors = vErrors;
  return errors === 0;
}
validate82.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
function validate88(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate88.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.reason === void 0 || !func0.call(data, "reason")) {
      const err0 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "reason" }, message: "must have required property 'reason'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.changed_paths === void 0 || !func0.call(data, "changed_paths")) {
      const err1 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "changed_paths" }, message: "must have required property 'changed_paths'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.before_digest === void 0 || !func0.call(data, "before_digest")) {
      const err2 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "before_digest" }, message: "must have required property 'before_digest'" };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.after_digest === void 0 || !func0.call(data, "after_digest")) {
      const err3 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "after_digest" }, message: "must have required property 'after_digest'" };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.reason !== void 0 && func0.call(data, "reason")) {
      if (typeof data.reason !== "string") {
        const err4 = { instancePath: instancePath + "/reason", schemaPath: "#/properties/reason/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.changed_paths !== void 0 && func0.call(data, "changed_paths")) {
      let data1 = data.changed_paths;
      if (Array.isArray(data1)) {
        const len0 = data1.length;
        for (let i0 = 0; i0 < len0; i0++) {
          if (typeof data1[i0] !== "string") {
            const err5 = { instancePath: instancePath + "/changed_paths/" + i0, schemaPath: "#/properties/changed_paths/items/type", keyword: "type", params: { type: "string" }, message: "must be string" };
            if (vErrors === null) {
              vErrors = [err5];
            } else {
              vErrors.push(err5);
            }
            errors++;
          }
        }
        let i1 = data1.length;
        let j0;
        if (i1 > 1) {
          const indices0 = {};
          for (; i1--; ) {
            let item0 = data1[i1];
            if (typeof item0 !== "string") {
              continue;
            }
            if (typeof indices0[item0] == "number") {
              j0 = indices0[item0];
              const err6 = { instancePath: instancePath + "/changed_paths", schemaPath: "#/properties/changed_paths/uniqueItems", keyword: "uniqueItems", params: { i: i1, j: j0 }, message: "must NOT have duplicate items (items ## " + j0 + " and " + i1 + " are identical)" };
              if (vErrors === null) {
                vErrors = [err6];
              } else {
                vErrors.push(err6);
              }
              errors++;
              break;
            }
            indices0[item0] = i1;
          }
        }
      } else {
        const err7 = { instancePath: instancePath + "/changed_paths", schemaPath: "#/properties/changed_paths/type", keyword: "type", params: { type: "array" }, message: "must be array" };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
    }
    if (data.before_digest !== void 0 && func0.call(data, "before_digest")) {
      let data3 = data.before_digest;
      if (typeof data3 === "string") {
        if (!pattern26.test(data3)) {
          const err8 = { instancePath: instancePath + "/before_digest", schemaPath: "#/$defs/Sha256Digest/pattern", keyword: "pattern", params: { pattern: "^[0-9a-f]{64}$" }, message: 'must match pattern "^[0-9a-f]{64}$"' };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors++;
        }
      } else {
        const err9 = { instancePath: instancePath + "/before_digest", schemaPath: "#/$defs/Sha256Digest/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
    }
    if (data.after_digest !== void 0 && func0.call(data, "after_digest")) {
      let data4 = data.after_digest;
      if (typeof data4 === "string") {
        if (!pattern26.test(data4)) {
          const err10 = { instancePath: instancePath + "/after_digest", schemaPath: "#/$defs/Sha256Digest/pattern", keyword: "pattern", params: { pattern: "^[0-9a-f]{64}$" }, message: 'must match pattern "^[0-9a-f]{64}$"' };
          if (vErrors === null) {
            vErrors = [err10];
          } else {
            vErrors.push(err10);
          }
          errors++;
        }
      } else {
        const err11 = { instancePath: instancePath + "/after_digest", schemaPath: "#/$defs/Sha256Digest/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err11];
        } else {
          vErrors.push(err11);
        }
        errors++;
      }
    }
  } else {
    const err12 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err12];
    } else {
      vErrors.push(err12);
    }
    errors++;
  }
  validate88.errors = vErrors;
  return errors === 0;
}
validate88.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
function validate86(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate86.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (!validate83(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
    vErrors = vErrors === null ? validate83.errors : vErrors.concat(validate83.errors);
    errors = vErrors.length;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.type === void 0 || !func0.call(data, "type")) {
      const err0 = { instancePath, schemaPath: "#/allOf/1/required", keyword: "required", params: { missingProperty: "type" }, message: "must have required property 'type'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.details === void 0 || !func0.call(data, "details")) {
      const err1 = { instancePath, schemaPath: "#/allOf/1/required", keyword: "required", params: { missingProperty: "details" }, message: "must have required property 'details'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.type !== void 0 && func0.call(data, "type")) {
      if ("DECLARATION_UPDATED" !== data.type) {
        const err2 = { instancePath: instancePath + "/type", schemaPath: "#/allOf/1/properties/type/const", keyword: "const", params: { allowedValue: "DECLARATION_UPDATED" }, message: "must be equal to constant" };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    if (data.details !== void 0 && func0.call(data, "details")) {
      if (!validate88(data.details, { instancePath: instancePath + "/details", parentData: data, parentDataProperty: "details", rootData, dynamicAnchors })) {
        vErrors = vErrors === null ? validate88.errors : vErrors.concat(validate88.errors);
        errors = vErrors.length;
      }
    }
  } else {
    const err3 = { instancePath, schemaPath: "#/allOf/1/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err3];
    } else {
      vErrors.push(err3);
    }
    errors++;
  }
  validate86.errors = vErrors;
  return errors === 0;
}
validate86.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
function validate93(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate93.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.response_id === void 0 || !func0.call(data, "response_id")) {
      const err0 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "response_id" }, message: "must have required property 'response_id'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.team === void 0 || !func0.call(data, "team")) {
      const err1 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "team" }, message: "must have required property 'team'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.decision === void 0 || !func0.call(data, "decision")) {
      const err2 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "decision" }, message: "must have required property 'decision'" };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.response_id !== void 0 && func0.call(data, "response_id")) {
      let data0 = data.response_id;
      if (typeof data0 === "string") {
        if (!pattern19.test(data0)) {
          const err3 = { instancePath: instancePath + "/response_id", schemaPath: "#/$defs/ResponseId/pattern", keyword: "pattern", params: { pattern: "^rsp_(?!.*(?:\\.\\.|[/\\\\]))[A-Za-z0-9_.-]+$" }, message: 'must match pattern "^rsp_(?!.*(?:\\.\\.|[/\\\\]))[A-Za-z0-9_.-]+$"' };
          if (vErrors === null) {
            vErrors = [err3];
          } else {
            vErrors.push(err3);
          }
          errors++;
        }
      } else {
        const err4 = { instancePath: instancePath + "/response_id", schemaPath: "#/$defs/ResponseId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.team !== void 0 && func0.call(data, "team")) {
      let data1 = data.team;
      if (typeof data1 === "string") {
        if (func74(data1) > 128) {
          const err5 = { instancePath: instancePath + "/team", schemaPath: "#/$defs/TeamId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        }
        if (func74(data1) < 1) {
          const err6 = { instancePath: instancePath + "/team", schemaPath: "#/$defs/TeamId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err6];
          } else {
            vErrors.push(err6);
          }
          errors++;
        }
        if (!pattern7.test(data1)) {
          const err7 = { instancePath: instancePath + "/team", schemaPath: "#/$defs/TeamId/pattern", keyword: "pattern", params: { pattern: "^(?!\\s)[\\s\\S]*\\S(?![\\s\\S])" }, message: 'must match pattern "^(?!\\s)[\\s\\S]*\\S(?![\\s\\S])"' };
          if (vErrors === null) {
            vErrors = [err7];
          } else {
            vErrors.push(err7);
          }
          errors++;
        }
      } else {
        const err8 = { instancePath: instancePath + "/team", schemaPath: "#/$defs/TeamId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      }
    }
    if (data.decision !== void 0 && func0.call(data, "decision")) {
      let data2 = data.decision;
      if (typeof data2 !== "string") {
        const err9 = { instancePath: instancePath + "/decision", schemaPath: "#/$defs/ResponseDecision/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
      if (!(data2 === "ACKNOWLEDGED" || data2 === "OBJECTED" || data2 === "EXTENSION_REQUESTED")) {
        const err10 = { instancePath: instancePath + "/decision", schemaPath: "#/$defs/ResponseDecision/enum", keyword: "enum", params: { allowedValues: schema81.enum }, message: "must be equal to one of the allowed values" };
        if (vErrors === null) {
          vErrors = [err10];
        } else {
          vErrors.push(err10);
        }
        errors++;
      }
    }
  } else {
    const err11 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err11];
    } else {
      vErrors.push(err11);
    }
    errors++;
  }
  validate93.errors = vErrors;
  return errors === 0;
}
validate93.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
function validate91(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate91.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (!validate83(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
    vErrors = vErrors === null ? validate83.errors : vErrors.concat(validate83.errors);
    errors = vErrors.length;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.type === void 0 || !func0.call(data, "type")) {
      const err0 = { instancePath, schemaPath: "#/allOf/1/required", keyword: "required", params: { missingProperty: "type" }, message: "must have required property 'type'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.details === void 0 || !func0.call(data, "details")) {
      const err1 = { instancePath, schemaPath: "#/allOf/1/required", keyword: "required", params: { missingProperty: "details" }, message: "must have required property 'details'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.type !== void 0 && func0.call(data, "type")) {
      if ("CONSUMER_RESPONDED" !== data.type) {
        const err2 = { instancePath: instancePath + "/type", schemaPath: "#/allOf/1/properties/type/const", keyword: "const", params: { allowedValue: "CONSUMER_RESPONDED" }, message: "must be equal to constant" };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    if (data.details !== void 0 && func0.call(data, "details")) {
      if (!validate93(data.details, { instancePath: instancePath + "/details", parentData: data, parentDataProperty: "details", rootData, dynamicAnchors })) {
        vErrors = vErrors === null ? validate93.errors : vErrors.concat(validate93.errors);
        errors = vErrors.length;
      }
    }
  } else {
    const err3 = { instancePath, schemaPath: "#/allOf/1/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err3];
    } else {
      vErrors.push(err3);
    }
    errors++;
  }
  validate91.errors = vErrors;
  return errors === 0;
}
validate91.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
function validate98(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate98.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.evidence_id === void 0 || !func0.call(data, "evidence_id")) {
      const err0 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "evidence_id" }, message: "must have required property 'evidence_id'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.team === void 0 || !func0.call(data, "team")) {
      const err1 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "team" }, message: "must have required property 'team'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.result === void 0 || !func0.call(data, "result")) {
      const err2 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "result" }, message: "must have required property 'result'" };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.evidence_id !== void 0 && func0.call(data, "evidence_id")) {
      let data0 = data.evidence_id;
      if (typeof data0 === "string") {
        if (!pattern22.test(data0)) {
          const err3 = { instancePath: instancePath + "/evidence_id", schemaPath: "#/$defs/EvidenceId/pattern", keyword: "pattern", params: { pattern: "^evd_(?!.*(?:\\.\\.|[/\\\\]))[A-Za-z0-9_.-]+$" }, message: 'must match pattern "^evd_(?!.*(?:\\.\\.|[/\\\\]))[A-Za-z0-9_.-]+$"' };
          if (vErrors === null) {
            vErrors = [err3];
          } else {
            vErrors.push(err3);
          }
          errors++;
        }
      } else {
        const err4 = { instancePath: instancePath + "/evidence_id", schemaPath: "#/$defs/EvidenceId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.team !== void 0 && func0.call(data, "team")) {
      let data1 = data.team;
      if (typeof data1 === "string") {
        if (func74(data1) > 128) {
          const err5 = { instancePath: instancePath + "/team", schemaPath: "#/$defs/TeamId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        }
        if (func74(data1) < 1) {
          const err6 = { instancePath: instancePath + "/team", schemaPath: "#/$defs/TeamId/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err6];
          } else {
            vErrors.push(err6);
          }
          errors++;
        }
        if (!pattern7.test(data1)) {
          const err7 = { instancePath: instancePath + "/team", schemaPath: "#/$defs/TeamId/pattern", keyword: "pattern", params: { pattern: "^(?!\\s)[\\s\\S]*\\S(?![\\s\\S])" }, message: 'must match pattern "^(?!\\s)[\\s\\S]*\\S(?![\\s\\S])"' };
          if (vErrors === null) {
            vErrors = [err7];
          } else {
            vErrors.push(err7);
          }
          errors++;
        }
      } else {
        const err8 = { instancePath: instancePath + "/team", schemaPath: "#/$defs/TeamId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      }
    }
    if (data.result !== void 0 && func0.call(data, "result")) {
      let data2 = data.result;
      if (typeof data2 !== "string") {
        const err9 = { instancePath: instancePath + "/result", schemaPath: "#/$defs/EvidenceResult/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
      if (!(data2 === "PASSED" || data2 === "FAILED")) {
        const err10 = { instancePath: instancePath + "/result", schemaPath: "#/$defs/EvidenceResult/enum", keyword: "enum", params: { allowedValues: schema91.enum }, message: "must be equal to one of the allowed values" };
        if (vErrors === null) {
          vErrors = [err10];
        } else {
          vErrors.push(err10);
        }
        errors++;
      }
    }
  } else {
    const err11 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err11];
    } else {
      vErrors.push(err11);
    }
    errors++;
  }
  validate98.errors = vErrors;
  return errors === 0;
}
validate98.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
function validate96(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate96.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (!validate83(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
    vErrors = vErrors === null ? validate83.errors : vErrors.concat(validate83.errors);
    errors = vErrors.length;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.type === void 0 || !func0.call(data, "type")) {
      const err0 = { instancePath, schemaPath: "#/allOf/1/required", keyword: "required", params: { missingProperty: "type" }, message: "must have required property 'type'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.details === void 0 || !func0.call(data, "details")) {
      const err1 = { instancePath, schemaPath: "#/allOf/1/required", keyword: "required", params: { missingProperty: "details" }, message: "must have required property 'details'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.type !== void 0 && func0.call(data, "type")) {
      if ("EVIDENCE_RECORDED" !== data.type) {
        const err2 = { instancePath: instancePath + "/type", schemaPath: "#/allOf/1/properties/type/const", keyword: "const", params: { allowedValue: "EVIDENCE_RECORDED" }, message: "must be equal to constant" };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    if (data.details !== void 0 && func0.call(data, "details")) {
      if (!validate98(data.details, { instancePath: instancePath + "/details", parentData: data, parentDataProperty: "details", rootData, dynamicAnchors })) {
        vErrors = vErrors === null ? validate98.errors : vErrors.concat(validate98.errors);
        errors = vErrors.length;
      }
    }
  } else {
    const err3 = { instancePath, schemaPath: "#/allOf/1/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err3];
    } else {
      vErrors.push(err3);
    }
    errors++;
  }
  validate96.errors = vErrors;
  return errors === 0;
}
validate96.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var schema120 = { "title": "Withdrawn or Rejected Event", "allOf": [{ "$ref": "#/$defs/EventCore" }, { "type": "object", "required": ["type", "details"], "properties": { "type": { "enum": ["WITHDRAWN", "REJECTED"] }, "details": { "$ref": "#/$defs/ReasonEventDetails" } } }] };
function validate101(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate101.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (!validate83(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
    vErrors = vErrors === null ? validate83.errors : vErrors.concat(validate83.errors);
    errors = vErrors.length;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.type === void 0 || !func0.call(data, "type")) {
      const err0 = { instancePath, schemaPath: "#/allOf/1/required", keyword: "required", params: { missingProperty: "type" }, message: "must have required property 'type'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.details === void 0 || !func0.call(data, "details")) {
      const err1 = { instancePath, schemaPath: "#/allOf/1/required", keyword: "required", params: { missingProperty: "details" }, message: "must have required property 'details'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.type !== void 0 && func0.call(data, "type")) {
      let data0 = data.type;
      if (!(data0 === "WITHDRAWN" || data0 === "REJECTED")) {
        const err2 = { instancePath: instancePath + "/type", schemaPath: "#/allOf/1/properties/type/enum", keyword: "enum", params: { allowedValues: schema120.allOf[1].properties.type.enum }, message: "must be equal to one of the allowed values" };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    if (data.details !== void 0 && func0.call(data, "details")) {
      let data1 = data.details;
      if (data1 && typeof data1 == "object" && !Array.isArray(data1)) {
        if (data1.reason === void 0 || !func0.call(data1, "reason")) {
          const err3 = { instancePath: instancePath + "/details", schemaPath: "#/$defs/ReasonEventDetails/required", keyword: "required", params: { missingProperty: "reason" }, message: "must have required property 'reason'" };
          if (vErrors === null) {
            vErrors = [err3];
          } else {
            vErrors.push(err3);
          }
          errors++;
        }
        if (data1.reason !== void 0 && func0.call(data1, "reason")) {
          if (typeof data1.reason !== "string") {
            const err4 = { instancePath: instancePath + "/details/reason", schemaPath: "#/$defs/ReasonEventDetails/properties/reason/type", keyword: "type", params: { type: "string" }, message: "must be string" };
            if (vErrors === null) {
              vErrors = [err4];
            } else {
              vErrors.push(err4);
            }
            errors++;
          }
        }
      } else {
        const err5 = { instancePath: instancePath + "/details", schemaPath: "#/$defs/ReasonEventDetails/type", keyword: "type", params: { type: "object" }, message: "must be object" };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
  } else {
    const err6 = { instancePath, schemaPath: "#/allOf/1/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err6];
    } else {
      vErrors.push(err6);
    }
    errors++;
  }
  validate101.errors = vErrors;
  return errors === 0;
}
validate101.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var schema122 = { "title": "Status-only Event", "allOf": [{ "$ref": "#/$defs/EventCore" }, { "type": "object", "required": ["type"], "properties": { "type": { "enum": ["PROPOSED", "ACCEPTED", "ENFORCING", "COMPLETED"] }, "details": { "$ref": "#/$defs/EmptyEventDetails" } } }] };
function validate104(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate104.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (!validate83(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
    vErrors = vErrors === null ? validate83.errors : vErrors.concat(validate83.errors);
    errors = vErrors.length;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.type === void 0 || !func0.call(data, "type")) {
      const err0 = { instancePath, schemaPath: "#/allOf/1/required", keyword: "required", params: { missingProperty: "type" }, message: "must have required property 'type'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.type !== void 0 && func0.call(data, "type")) {
      let data0 = data.type;
      if (!(data0 === "PROPOSED" || data0 === "ACCEPTED" || data0 === "ENFORCING" || data0 === "COMPLETED")) {
        const err1 = { instancePath: instancePath + "/type", schemaPath: "#/allOf/1/properties/type/enum", keyword: "enum", params: { allowedValues: schema122.allOf[1].properties.type.enum }, message: "must be equal to one of the allowed values" };
        if (vErrors === null) {
          vErrors = [err1];
        } else {
          vErrors.push(err1);
        }
        errors++;
      }
    }
    if (data.details !== void 0 && func0.call(data, "details")) {
      let data1 = data.details;
      if (data1 && typeof data1 == "object" && !Array.isArray(data1)) {
      } else {
        const err2 = { instancePath: instancePath + "/details", schemaPath: "#/$defs/EmptyEventDetails/type", keyword: "type", params: { type: "object" }, message: "must be object" };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
  } else {
    const err3 = { instancePath, schemaPath: "#/allOf/1/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err3];
    } else {
      vErrors.push(err3);
    }
    errors++;
  }
  validate104.errors = vErrors;
  return errors === 0;
}
validate104.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
function validate81(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate81.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  const _errs0 = errors;
  let valid0 = false;
  let passing0 = null;
  const _errs1 = errors;
  if (!validate82(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
    vErrors = vErrors === null ? validate82.errors : vErrors.concat(validate82.errors);
    errors = vErrors.length;
  }
  var _valid0 = _errs1 === errors;
  if (_valid0) {
    valid0 = true;
    passing0 = 0;
    var props0 = true;
  }
  const _errs2 = errors;
  if (!validate86(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
    vErrors = vErrors === null ? validate86.errors : vErrors.concat(validate86.errors);
    errors = vErrors.length;
  }
  var _valid0 = _errs2 === errors;
  if (_valid0 && valid0) {
    valid0 = false;
    passing0 = [passing0, 1];
  } else {
    if (_valid0) {
      valid0 = true;
      passing0 = 1;
      if (props0 !== true) {
        props0 = true;
      }
    }
    const _errs3 = errors;
    if (!validate91(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
      vErrors = vErrors === null ? validate91.errors : vErrors.concat(validate91.errors);
      errors = vErrors.length;
    }
    var _valid0 = _errs3 === errors;
    if (_valid0 && valid0) {
      valid0 = false;
      passing0 = [passing0, 2];
    } else {
      if (_valid0) {
        valid0 = true;
        passing0 = 2;
        if (props0 !== true) {
          props0 = true;
        }
      }
      const _errs4 = errors;
      if (!validate96(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
        vErrors = vErrors === null ? validate96.errors : vErrors.concat(validate96.errors);
        errors = vErrors.length;
      }
      var _valid0 = _errs4 === errors;
      if (_valid0 && valid0) {
        valid0 = false;
        passing0 = [passing0, 3];
      } else {
        if (_valid0) {
          valid0 = true;
          passing0 = 3;
          if (props0 !== true) {
            props0 = true;
          }
        }
        const _errs5 = errors;
        if (!validate101(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
          vErrors = vErrors === null ? validate101.errors : vErrors.concat(validate101.errors);
          errors = vErrors.length;
        }
        var _valid0 = _errs5 === errors;
        if (_valid0 && valid0) {
          valid0 = false;
          passing0 = [passing0, 4];
        } else {
          if (_valid0) {
            valid0 = true;
            passing0 = 4;
            if (props0 !== true) {
              props0 = true;
            }
          }
          const _errs6 = errors;
          if (!validate104(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
            vErrors = vErrors === null ? validate104.errors : vErrors.concat(validate104.errors);
            errors = vErrors.length;
          }
          var _valid0 = _errs6 === errors;
          if (_valid0 && valid0) {
            valid0 = false;
            passing0 = [passing0, 5];
          } else {
            if (_valid0) {
              valid0 = true;
              passing0 = 5;
              if (props0 !== true) {
                props0 = true;
              }
            }
          }
        }
      }
    }
  }
  if (!valid0) {
    const err0 = { instancePath, schemaPath: "#/oneOf", keyword: "oneOf", params: { passingSchemas: passing0 }, message: "must match exactly one schema in oneOf" };
    if (vErrors === null) {
      vErrors = [err0];
    } else {
      vErrors.push(err0);
    }
    errors++;
  } else {
    errors = _errs0;
    if (vErrors !== null) {
      if (_errs0) {
        vErrors.length = _errs0;
      } else {
        vErrors = null;
      }
    }
  }
  validate81.errors = vErrors;
  evaluated0.props = props0;
  return errors === 0;
}
validate81.evaluated = { "dynamicProps": true, "dynamicItems": false };
function validate20(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  ;
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate20.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.protocol_version === void 0 || !func0.call(data, "protocol_version")) {
      const err0 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "protocol_version" }, message: "must have required property 'protocol_version'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.declaration_id === void 0 || !func0.call(data, "declaration_id")) {
      const err1 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "declaration_id" }, message: "must have required property 'declaration_id'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.created_at === void 0 || !func0.call(data, "created_at")) {
      const err2 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "created_at" }, message: "must have required property 'created_at'" };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.revision === void 0 || !func0.call(data, "revision")) {
      const err3 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "revision" }, message: "must have required property 'revision'" };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.status === void 0 || !func0.call(data, "status")) {
      const err4 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "status" }, message: "must have required property 'status'" };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    if (data.producer === void 0 || !func0.call(data, "producer")) {
      const err5 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "producer" }, message: "must have required property 'producer'" };
      if (vErrors === null) {
        vErrors = [err5];
      } else {
        vErrors.push(err5);
      }
      errors++;
    }
    if (data.changes === void 0 || !func0.call(data, "changes")) {
      const err6 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "changes" }, message: "must have required property 'changes'" };
      if (vErrors === null) {
        vErrors = [err6];
      } else {
        vErrors.push(err6);
      }
      errors++;
    }
    if (data.intent === void 0 || !func0.call(data, "intent")) {
      const err7 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "intent" }, message: "must have required property 'intent'" };
      if (vErrors === null) {
        vErrors = [err7];
      } else {
        vErrors.push(err7);
      }
      errors++;
    }
    if (data.consumers === void 0 || !func0.call(data, "consumers")) {
      const err8 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "consumers" }, message: "must have required property 'consumers'" };
      if (vErrors === null) {
        vErrors = [err8];
      } else {
        vErrors.push(err8);
      }
      errors++;
    }
    if (data.responses === void 0 || !func0.call(data, "responses")) {
      const err9 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "responses" }, message: "must have required property 'responses'" };
      if (vErrors === null) {
        vErrors = [err9];
      } else {
        vErrors.push(err9);
      }
      errors++;
    }
    if (data.evidence === void 0 || !func0.call(data, "evidence")) {
      const err10 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "evidence" }, message: "must have required property 'evidence'" };
      if (vErrors === null) {
        vErrors = [err10];
      } else {
        vErrors.push(err10);
      }
      errors++;
    }
    if (data.events === void 0 || !func0.call(data, "events")) {
      const err11 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "events" }, message: "must have required property 'events'" };
      if (vErrors === null) {
        vErrors = [err11];
      } else {
        vErrors.push(err11);
      }
      errors++;
    }
    if (data.protocol_version !== void 0 && func0.call(data, "protocol_version")) {
      let data0 = data.protocol_version;
      if (typeof data0 === "string") {
        if (!pattern4.test(data0)) {
          const err12 = { instancePath: instancePath + "/protocol_version", schemaPath: "#/$defs/ProtocolVersion/pattern", keyword: "pattern", params: { pattern: "^(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)(?:-((?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)(?:\\.(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\\+([0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*))?$" }, message: 'must match pattern "^(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)(?:-((?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)(?:\\.(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\\+([0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*))?$"' };
          if (vErrors === null) {
            vErrors = [err12];
          } else {
            vErrors.push(err12);
          }
          errors++;
        }
      } else {
        const err13 = { instancePath: instancePath + "/protocol_version", schemaPath: "#/$defs/ProtocolVersion/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err13];
        } else {
          vErrors.push(err13);
        }
        errors++;
      }
    }
    if (data.declaration_id !== void 0 && func0.call(data, "declaration_id")) {
      let data1 = data.declaration_id;
      if (typeof data1 === "string") {
        if (func74(data1) > 128) {
          const err14 = { instancePath: instancePath + "/declaration_id", schemaPath: "#/$defs/DeclarationId/maxLength", keyword: "maxLength", params: { limit: 128 }, message: "must NOT have more than 128 characters" };
          if (vErrors === null) {
            vErrors = [err14];
          } else {
            vErrors.push(err14);
          }
          errors++;
        }
        if (!pattern5.test(data1)) {
          const err15 = { instancePath: instancePath + "/declaration_id", schemaPath: "#/$defs/DeclarationId/pattern", keyword: "pattern", params: { pattern: "^[A-Za-z0-9](?!.*\\.\\.)[A-Za-z0-9_.-]*$" }, message: 'must match pattern "^[A-Za-z0-9](?!.*\\.\\.)[A-Za-z0-9_.-]*$"' };
          if (vErrors === null) {
            vErrors = [err15];
          } else {
            vErrors.push(err15);
          }
          errors++;
        }
      } else {
        const err16 = { instancePath: instancePath + "/declaration_id", schemaPath: "#/$defs/DeclarationId/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err16];
        } else {
          vErrors.push(err16);
        }
        errors++;
      }
    }
    if (data.created_at !== void 0 && func0.call(data, "created_at")) {
      let data2 = data.created_at;
      if (typeof data2 === "string") {
        if (!pattern6.test(data2)) {
          const err17 = { instancePath: instancePath + "/created_at", schemaPath: "#/$defs/Timestamp/pattern", keyword: "pattern", params: { pattern: "^[0-9]{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01])[Tt](?:[01][0-9]|2[0-3]):[0-5][0-9]:(?:[0-5][0-9]|60)(?:\\.[0-9]+)?(?:[Zz]|[+-](?:[01][0-9]|2[0-3]):[0-5][0-9])(?![\\s\\S])" }, message: 'must match pattern "^[0-9]{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01])[Tt](?:[01][0-9]|2[0-3]):[0-5][0-9]:(?:[0-5][0-9]|60)(?:\\.[0-9]+)?(?:[Zz]|[+-](?:[01][0-9]|2[0-3]):[0-5][0-9])(?![\\s\\S])"' };
          if (vErrors === null) {
            vErrors = [err17];
          } else {
            vErrors.push(err17);
          }
          errors++;
        }
        if (!formats0.validate(data2)) {
          const err18 = { instancePath: instancePath + "/created_at", schemaPath: "#/$defs/Timestamp/format", keyword: "format", params: { format: "date-time" }, message: 'must match format "date-time"' };
          if (vErrors === null) {
            vErrors = [err18];
          } else {
            vErrors.push(err18);
          }
          errors++;
        }
      } else {
        const err19 = { instancePath: instancePath + "/created_at", schemaPath: "#/$defs/Timestamp/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err19];
        } else {
          vErrors.push(err19);
        }
        errors++;
      }
    }
    if (data.revision !== void 0 && func0.call(data, "revision")) {
      let data3 = data.revision;
      if (!(typeof data3 == "number" && (!(data3 % 1) && !isNaN(data3)) && isFinite(data3))) {
        const err20 = { instancePath: instancePath + "/revision", schemaPath: "#/$defs/Revision/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
        if (vErrors === null) {
          vErrors = [err20];
        } else {
          vErrors.push(err20);
        }
        errors++;
      }
      if (typeof data3 == "number" && isFinite(data3)) {
        if (data3 < 1 || isNaN(data3)) {
          const err21 = { instancePath: instancePath + "/revision", schemaPath: "#/$defs/Revision/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" };
          if (vErrors === null) {
            vErrors = [err21];
          } else {
            vErrors.push(err21);
          }
          errors++;
        }
      }
    }
    if (data.status !== void 0 && func0.call(data, "status")) {
      let data4 = data.status;
      if (typeof data4 !== "string") {
        const err22 = { instancePath: instancePath + "/status", schemaPath: "#/$defs/Status/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err22];
        } else {
          vErrors.push(err22);
        }
        errors++;
      }
      if (!(data4 === "DRAFT" || data4 === "PROPOSED" || data4 === "UNDER_REVIEW" || data4 === "ACCEPTED" || data4 === "ENFORCING" || data4 === "COMPLETED" || data4 === "WITHDRAWN" || data4 === "REJECTED")) {
        const err23 = { instancePath: instancePath + "/status", schemaPath: "#/$defs/Status/enum", keyword: "enum", params: { allowedValues: schema36.enum }, message: "must be equal to one of the allowed values" };
        if (vErrors === null) {
          vErrors = [err23];
        } else {
          vErrors.push(err23);
        }
        errors++;
      }
    }
    if (data.producer !== void 0 && func0.call(data, "producer")) {
      if (!validate21(data.producer, { instancePath: instancePath + "/producer", parentData: data, parentDataProperty: "producer", rootData, dynamicAnchors })) {
        vErrors = vErrors === null ? validate21.errors : vErrors.concat(validate21.errors);
        errors = vErrors.length;
      }
    }
    if (data.changes !== void 0 && func0.call(data, "changes")) {
      let data6 = data.changes;
      if (Array.isArray(data6)) {
        if (data6.length < 1) {
          const err24 = { instancePath: instancePath + "/changes", schemaPath: "#/properties/changes/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" };
          if (vErrors === null) {
            vErrors = [err24];
          } else {
            vErrors.push(err24);
          }
          errors++;
        }
        const len0 = data6.length;
        for (let i0 = 0; i0 < len0; i0++) {
          if (!validate23(data6[i0], { instancePath: instancePath + "/changes/" + i0, parentData: data6, parentDataProperty: i0, rootData, dynamicAnchors })) {
            vErrors = vErrors === null ? validate23.errors : vErrors.concat(validate23.errors);
            errors = vErrors.length;
          }
        }
        let i1 = data6.length;
        let j0;
        if (i1 > 1) {
          outer0: for (; i1--; ) {
            for (j0 = i1; j0--; ) {
              if (func27(data6[i1], data6[j0])) {
                const err25 = { instancePath: instancePath + "/changes", schemaPath: "#/properties/changes/uniqueItems", keyword: "uniqueItems", params: { i: i1, j: j0 }, message: "must NOT have duplicate items (items ## " + j0 + " and " + i1 + " are identical)" };
                if (vErrors === null) {
                  vErrors = [err25];
                } else {
                  vErrors.push(err25);
                }
                errors++;
                break outer0;
              }
            }
          }
        }
      } else {
        const err26 = { instancePath: instancePath + "/changes", schemaPath: "#/properties/changes/type", keyword: "type", params: { type: "array" }, message: "must be array" };
        if (vErrors === null) {
          vErrors = [err26];
        } else {
          vErrors.push(err26);
        }
        errors++;
      }
    }
    if (data.intent !== void 0 && func0.call(data, "intent")) {
      if (!validate65(data.intent, { instancePath: instancePath + "/intent", parentData: data, parentDataProperty: "intent", rootData, dynamicAnchors })) {
        vErrors = vErrors === null ? validate65.errors : vErrors.concat(validate65.errors);
        errors = vErrors.length;
      }
    }
    if (data.consumers !== void 0 && func0.call(data, "consumers")) {
      let data9 = data.consumers;
      if (Array.isArray(data9)) {
        const len1 = data9.length;
        for (let i2 = 0; i2 < len1; i2++) {
          if (!validate71(data9[i2], { instancePath: instancePath + "/consumers/" + i2, parentData: data9, parentDataProperty: i2, rootData, dynamicAnchors })) {
            vErrors = vErrors === null ? validate71.errors : vErrors.concat(validate71.errors);
            errors = vErrors.length;
          }
        }
        let i3 = data9.length;
        let j1;
        if (i3 > 1) {
          outer1: for (; i3--; ) {
            for (j1 = i3; j1--; ) {
              if (func27(data9[i3], data9[j1])) {
                const err27 = { instancePath: instancePath + "/consumers", schemaPath: "#/properties/consumers/uniqueItems", keyword: "uniqueItems", params: { i: i3, j: j1 }, message: "must NOT have duplicate items (items ## " + j1 + " and " + i3 + " are identical)" };
                if (vErrors === null) {
                  vErrors = [err27];
                } else {
                  vErrors.push(err27);
                }
                errors++;
                break outer1;
              }
            }
          }
        }
      } else {
        const err28 = { instancePath: instancePath + "/consumers", schemaPath: "#/properties/consumers/type", keyword: "type", params: { type: "array" }, message: "must be array" };
        if (vErrors === null) {
          vErrors = [err28];
        } else {
          vErrors.push(err28);
        }
        errors++;
      }
    }
    if (data.responses !== void 0 && func0.call(data, "responses")) {
      let data11 = data.responses;
      if (Array.isArray(data11)) {
        const len2 = data11.length;
        for (let i4 = 0; i4 < len2; i4++) {
          if (!validate73(data11[i4], { instancePath: instancePath + "/responses/" + i4, parentData: data11, parentDataProperty: i4, rootData, dynamicAnchors })) {
            vErrors = vErrors === null ? validate73.errors : vErrors.concat(validate73.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err29 = { instancePath: instancePath + "/responses", schemaPath: "#/properties/responses/type", keyword: "type", params: { type: "array" }, message: "must be array" };
        if (vErrors === null) {
          vErrors = [err29];
        } else {
          vErrors.push(err29);
        }
        errors++;
      }
    }
    if (data.evidence !== void 0 && func0.call(data, "evidence")) {
      let data13 = data.evidence;
      if (Array.isArray(data13)) {
        const len3 = data13.length;
        for (let i5 = 0; i5 < len3; i5++) {
          if (!validate75(data13[i5], { instancePath: instancePath + "/evidence/" + i5, parentData: data13, parentDataProperty: i5, rootData, dynamicAnchors })) {
            vErrors = vErrors === null ? validate75.errors : vErrors.concat(validate75.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err30 = { instancePath: instancePath + "/evidence", schemaPath: "#/properties/evidence/type", keyword: "type", params: { type: "array" }, message: "must be array" };
        if (vErrors === null) {
          vErrors = [err30];
        } else {
          vErrors.push(err30);
        }
        errors++;
      }
    }
    if (data.events !== void 0 && func0.call(data, "events")) {
      let data15 = data.events;
      if (Array.isArray(data15)) {
        const len4 = data15.length;
        for (let i6 = 0; i6 < len4; i6++) {
          if (!validate81(data15[i6], { instancePath: instancePath + "/events/" + i6, parentData: data15, parentDataProperty: i6, rootData, dynamicAnchors })) {
            vErrors = vErrors === null ? validate81.errors : vErrors.concat(validate81.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err31 = { instancePath: instancePath + "/events", schemaPath: "#/properties/events/type", keyword: "type", params: { type: "array" }, message: "must be array" };
        if (vErrors === null) {
          vErrors = [err31];
        } else {
          vErrors.push(err31);
        }
        errors++;
      }
    }
  } else {
    const err32 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err32];
    } else {
      vErrors.push(err32);
    }
    errors++;
  }
  validate20.errors = vErrors;
  return errors === 0;
}
validate20.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
