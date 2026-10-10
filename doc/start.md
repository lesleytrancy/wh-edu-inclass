1. Ensure that the Ipad and the Laptop are on the same internet connection.

2. Run:

```
npm run dev -- --host 0.0.0.0
```

3. Use the exact `Local` or `Network` URL printed by Vite. Local development uses HTTP. The port may differ if 5173 is occupied:

```
  VITE v8.3.0  ready in 348 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.1.7:5173/
```

If this is the case, open the PWA (looks like an app) on the Ipad, labelled "`武侯课教智慧课堂`"

If another port is printed, use that port in Safari. Do not change `http` to `https`: the local server does not speak HTTPS. For an HTTPS address on another device, use the Cloudflare Tunnel command in README.md.
