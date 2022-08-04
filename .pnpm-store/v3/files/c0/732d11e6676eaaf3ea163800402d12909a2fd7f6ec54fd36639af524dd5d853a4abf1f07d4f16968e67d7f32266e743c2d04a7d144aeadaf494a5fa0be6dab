import { warn } from "./logger/core.js";
function createRequest({
  url,
  headers,
  method = "GET",
  body = void 0,
  logging,
  ssr
}) {
  let headersObj = headers instanceof Headers ? headers : new Headers(Object.entries(headers));
  const request = new Request(url.toString(), {
    method,
    headers: headersObj,
    body
  });
  Object.defineProperties(request, {
    canonicalURL: {
      get() {
        warn(logging, "deprecation", `Astro.request.canonicalURL has been moved to Astro.canonicalURL`);
        return void 0;
      }
    },
    params: {
      get() {
        warn(logging, "deprecation", `Astro.request.params has been moved to Astro.params`);
        return void 0;
      }
    }
  });
  if (!ssr) {
    const _headers = request.headers;
    const headersDesc = Object.getOwnPropertyDescriptor(request, "headers") || {};
    Object.defineProperty(request, "headers", {
      ...headersDesc,
      get() {
        warn(logging, "ssg", `Headers are not exposed in static-site generation (SSG) mode. To enable reading headers you need to set an SSR adapter in your config.`);
        return _headers;
      }
    });
  }
  return request;
}
export {
  createRequest
};
