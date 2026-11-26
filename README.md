# Pomodoro Productivity Tool
This application has a web interface allowing you to take control of your productivity.

Yet to be completed\
a) Browser app\
maybe) The browser app could theoretically be given full mobile support on iOS and Android (as a web app, accessible via homescreen)\

Currently completed\
Chromium (Chrome, Edge, Brave) and Firefox browser extensions, built by GitHub Actions: download them from the latest workflow run's artifacts, a GitHub Release, or the site's `downloads/` folder (see [DEVELOPING.md](DEVELOPING.md#build-the-extensions-and-the-site))\
Local network sync between your browsers and devices, with a 6-digit verification code for pairing and optional automatic sync (see [docs/SYNC.md](docs/SYNC.md)). Each device runs the small sync service: `node pomodoro-sync.mjs`. If a device doesn't appear, run `node pomodoro-sync.mjs firewall --apply` to open the port in that device's firewall, or `node pomodoro-sync.mjs doctor` to find the problem\
Hosted via GitHub pages: https://ryansapp1206.github.io/cs324 (create an account to start; it's stored on your device)\

A project for CS 324.\
