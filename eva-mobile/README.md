# Eva Mobile (Capacitor → Android APK)

Installable Android app embedding shared `eva-web`. Talks to PC `eva-core` over LAN HTTP.

## Build

From repo root:

```bash
npm run eva:web:build
npm run eva:mobile:sync
npm run eva:mobile:open
```

In Android Studio: Run on device, or Build → Build APK(s).

## Cleartext LAN

`AndroidManifest.xml` sets `android:usesCleartextTraffic="true"` and
`res/xml/network_security_config.xml` permits cleartext so the app can call
`http://<PC-LAN-IP>:8787`.

## In-app setup

First launch → **設定**: PC base URL + `EVA_API_TOKEN`, then **測試連線**.

Full guide: [EVA.md](../EVA.md).
