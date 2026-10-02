1. Ensure that the Ipad and the Laptop are on the same internet connection.

2. Run:

```
npm run dev --host 0.0.0.0
```

3. ensure that the output shows the port as being "5173", you should see the following:

```
  VITE v8.3.0  ready in 348 ms

  ➜  Local:   https://localhost:5173/
  ➜  Local:   https://Lesleys-MacBook-Air.local:5173/
  ➜  Network: https://192.168.1.7:5173/  en0
```

If this is the case, open the PWA (looks like an app) on the Ipad, labelled "`武侯课教智慧课堂`"

If not, close any other Vite processes that are running OR open the correct port via "`https://Lesleys-MacBook-Air.local:CORRECT_PORT`" in Safari
