# Nyan

A pixel cat that lives on your Windows desktop. It reacts to your keyboard and
mouse, and it knows when **Claude Code** is thinking, needs you, or has
finished, including when Claude Code runs inside **WSL**.

Free and open source (MIT).

> **Status: early.** The plumbing works. The cat is still a placeholder box
> while the real pixel art is drawn.

## Install

Download `Nyan-Setup-x.y.z.exe` from [Releases](https://github.com/faseJade/nyan/releases)
and run it. Nyan updates itself from new releases.

Windows will say **"Windows protected your PC"** because the installer isn't
code-signed yet (signing costs money; we're working on a free option for
open-source projects). Click **More info → Run anyway**.

## Connect Claude Code

Run this where Claude Code runs (Windows, or inside WSL):

```bash
git clone https://github.com/faseJade/nyan && cd nyan
npm run install-hooks     # adds Nyan's hooks to ~/.claude/settings.json (backup kept)
npm run remove-hooks      # takes them out again
```

The hook sends Claude's state to Nyan at `127.0.0.1:23457`. If Nyan isn't
running, the hook gives up within a fraction of a second, so Claude is never
slowed down.

**Claude Code in WSL:** turn on WSL mirrored networking so WSL's `127.0.0.1`
reaches Windows. Add this to `C:\Users\<you>\.wslconfig`, then run
`wsl --shutdown`:

```ini
[wsl2]
networkingMode=mirrored
```

## Privacy

Nyan watches your keyboard and mouse globally, which is also what a keylogger
does. So, plainly:

- **Nyan never knows which key you pressed.** The input hook turns every
  keypress into "a key was pressed" before anything else sees it
  ([`shared/input-events.js`](shared/input-events.js), with tests).
- **Nothing leaves your computer.** No analytics, no telemetry, no account.
  The only network traffic is the update check against GitHub Releases, and
  Claude Code's hook talking to Nyan on `127.0.0.1`.
- Nothing is logged or saved except your settings (position, preferences).

If antivirus flags Nyan, it's the keyboard hook. The code is all here to check.

## Develop

Needs Node 22 on Windows.

```bash
npm install
npm start        # run it
npm test         # tests (also run on every push)
npm run dist     # build the installer into dist/
```

Releasing: bump `version` in `package.json`, then push a matching tag
(`git tag v0.2.0 && git push --tags`). GitHub Actions builds the installer
and publishes the release.

## Credits

Inspired by [Comnyang](https://comnyang.com). Nyan is an independent project
with its own art and code.
