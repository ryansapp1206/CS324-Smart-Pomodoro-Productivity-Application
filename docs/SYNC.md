# Syncing between devices on your local network

Pomodoro keeps your account on each device and syncs it directly between your own devices over your home or office network. Nothing goes to a server on the internet.

## Set it up

Browsers can't open a network port themselves, so every device that syncs runs a small helper, the **sync service**. It's one file, [`sync-service/pomodoro-sync.mjs`](../sync-service/pomodoro-sync.mjs), and the site also serves it at `downloads/pomodoro-sync.mjs`. It needs [Node.js](https://nodejs.org) 18 or newer and nothing else.

On **each** device:

1. Start the service:
   ```
   node pomodoro-sync.mjs
   ```
   To have it start whenever you log in, run `node pomodoro-sync.mjs install` (`uninstall` undoes it). This uses systemd on Linux, launchd on macOS and the Startup folder on Windows.
2. Open the port in the firewall (see [Troubleshooting](#a-device-doesnt-appear)):
   ```
   node pomodoro-sync.mjs firewall --apply
   ```
3. Open Pomodoro, log in, and go to **Settings → Devices and pairing**.

Then pair:

1. On one device, under **Nearby devices**, select the other device.
2. The other device shows a **6-digit code** and the account asking (a notification appears if Pomodoro is closed there).
3. Type the code on the first device, and press **Accept** on the other one.

Both devices then sync. With **Sync automatically** on (Settings, or the Devices screen), changes are sent within about 30 seconds while the extension is installed, or while the website is open. **Sync now** in the header menu sends them straight away.

Several browsers on the same computer each count as their own device and can pair with each other too.

## A device doesn't appear

Run these on the device that's missing, then on the other one:

| Command | What it does |
| --- | --- |
| `node pomodoro-sync.mjs firewall` | Shows the commands that let other devices through this computer's firewall: `ufw`, `firewalld`, `nftables` or `iptables` on Linux, the Application Firewall on macOS, `netsh` on Windows |
| `node pomodoro-sync.mjs firewall --apply` | Runs them. It asks for your password; on Windows, open the terminal with **Run as administrator** |
| `node pomodoro-sync.mjs doctor` | Checks that the service runs, the network addresses, the firewall and VPNs, looks for other devices for 3 seconds, and lists what to fix |
| `node pomodoro-sync.mjs status` | Shows whether the service runs and which computers it has found |

The Devices screen shows the same commands under **Troubleshooting**, with this computer's exact firewall commands, and a **Copy** button for each.

Other common causes:
- The devices are on different networks. A guest Wi-Fi, or "AP/client isolation" on the router, keeps devices apart.
- A VPN is on.
- On Windows, the network is set to **Public**. The firewall rule covers Private networks only, so set the network to Private.
- The network blocks broadcasts. Use **Add a device by address** on the Devices screen with the other computer's IP address. The Troubleshooting section shows this computer's address.

Every device must use the same port (47821 by default). To change it, start every service with `--port <n>` and set `syncPort` in `src/config.js`.

## How it's kept safe

- **Nothing is shared before both sides confirm.** Before pairing, the only things sent are public keys, random numbers, and the requesting account's name and email, so the other device can show who's asking. Data moves only after the code typed on one device matches the code shown on the other, **and** that device's user pressed Accept.
- **The code can't be faked.** The devices agree on a key with ECDH (P-256). The device that starts first sends only a commitment (a hash) to its key, and reveals the key after it has received the other side's. The 6-digit code comes from both keys, so someone in the middle can't choose keys that give the same code. They get one guess in a million, and three wrong tries end the pairing. Pairing requests expire after 5 minutes.
- **Everything after pairing is encrypted.** Every message is encrypted and authenticated with AES-256-GCM using the pair's own key, which comes from HKDF. Each message is bound to who sent it and who it's for, and anything that doesn't decrypt is dropped. The sync service only ever passes encrypted messages along.
- **The service only answers this computer.** Its app API (`/api/…`) refuses other computers. It also refuses web pages other than the Pomodoro extension, `localhost`, and the Pomodoro website (add more with `--allow-origin`). It checks the `Host` header against DNS rebinding. Each app has a secret token for its own inbox.
- Data is only exchanged with devices paired to the account that's signed in. **Unpair** removes the key on both devices.

## How merging works

`src/sync/merge.js` merges two copies so both devices end up identical, whatever order messages arrive in:

| Data | Rule |
| --- | --- |
| Tasks | The latest edit wins (`updatedAt`). A deletion wins over edits made before it |
| Focus sessions | Everything from both sides (each has a unique id) |
| Purchases | Everything from both sides, one per item |
| Settings | The latest saved copy wins |
| Display name | The latest change wins |

## Where the code is

```
sync-service/pomodoro-sync.mjs   the sync service: discovery (UDP broadcast), message relay (HTTP), doctor, firewall, install
src/sync/engine.js              pairing and syncing (runs in the extension background, or the website page)
src/sync/crypto.js              keys, the 6-digit code, encryption (Web Crypto)
src/sync/merge.js               merging two devices' data
src/sync/relay.js               talking to the sync service on 127.0.0.1
src/app/sync-client.js          the screens' view of sync, and how often they check in
src/screens/devices.js          the Devices screen
src/data/local-backend.js       accounts and data on this device, plus exportSnapshot / importSnapshot
```

Service API, for reference. The `/api/…` endpoints are local only; the ones marked * need the `x-device-id` and `x-device-token` headers.

| Endpoint | Use |
| --- | --- |
| `GET /api/status` | service name, port, addresses, this computer's firewall commands |
| `POST /api/register` | an app announces itself `{ deviceId, token, name, platform }` |
| `GET /api/devices` * | nearby devices (other apps here and on other computers) |
| `POST /api/send` * | `{ to, message }` to another app |
| `GET /api/inbox` * | take waiting messages |
| `POST /api/add-peer` * | `{ address }` reach a computer by IP |
| `GET /peer/hello`, `POST /peer/deliver` | between services on the network |
