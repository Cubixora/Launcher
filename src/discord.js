'use strict';
// Discord Rich Presence (bağımlılıksız, yerel IPC). Kimlik/metinler admin panelinden (config/branding) gelir.
const net = require('net');
const os = require('os');
const path = require('path');

module.exports = function createDiscord({ remote, getSettings, log }) {
  let sock = null, clientId = '', ready = false, buf = Buffer.alloc(0), retry = null, startTs = Date.now();
  let state = { phase: 'menu', version: '', server: '', player: '' };
  let wanted = null, nonce = 1, connecting = false;

  const pipePaths = () => {
    if (process.platform === 'win32') return Array.from({ length: 10 }, (_, i) => `\\\\?\\pipe\\discord-ipc-${i}`);
    const base = process.env.XDG_RUNTIME_DIR || process.env.TMPDIR || '/tmp';
    return Array.from({ length: 10 }, (_, i) => path.join(base, `discord-ipc-${i}`));
  };
  const frame = (op, obj) => {
    const j = Buffer.from(JSON.stringify(obj));
    const h = Buffer.alloc(8); h.writeInt32LE(op, 0); h.writeInt32LE(j.length, 4);
    return Buffer.concat([h, j]);
  };
  const close = () => { try { sock && sock.destroy(); } catch {} sock = null; ready = false; connecting = false; };

  function tryConnect(i = 0) {
    const list = pipePaths();
    if (i >= list.length) { connecting = false; return schedule(); }
    const s = net.createConnection(list[i]);
    let ok = false;
    s.once('connect', () => {
      ok = true; sock = s; buf = Buffer.alloc(0);
      s.write(frame(0, { v: 1, client_id: clientId }));
    });
    s.on('data', (d) => {
      buf = Buffer.concat([buf, d]);
      while (buf.length >= 8) {
        const len = buf.readInt32LE(4);
        if (buf.length < 8 + len) break;
        let msg = null; try { msg = JSON.parse(buf.slice(8, 8 + len).toString()); } catch {}
        buf = buf.slice(8 + len);
        if (msg && msg.evt === 'READY') { ready = true; push(); }
      }
    });
    s.on('error', () => { if (!ok) tryConnect(i + 1); });
    s.on('close', () => { if (ok) { sock = null; ready = false; connecting = false; schedule(); } });
  }
  function schedule() { if (retry || !clientId) return; retry = setTimeout(() => { retry = null; connect(); }, 15000); }
  function connect() { if (sock || connecting || !clientId) return; connecting = true; try { tryConnect(0); } catch { connecting = false; } }

  const fill = (t) => String(t || '').replace(/\{surum\}/g, state.version || '').replace(/\{sunucu\}/g, state.server || '').replace(/\{oyuncu\}/g, state.player || '').trim();

  async function build() {
    const b = (await remote('branding', {}, 60 * 1000)) || {};
    if (b.discordEnabled === false) return { off: true, id: '' };
    const id = String(b.discordId || '').trim();
    const playing = state.phase === 'game';
    const details = fill(playing ? (b.discordGameDetails || 'Minecraft {surum} oynuyor') : (b.discordMenuDetails || 'Cubixora Launcher oynuyor'));
    const st = fill(playing ? (state.server ? (b.discordServerState || '{sunucu} sunucusunda') : (b.discordGameState || 'Cubixora Client ile')) : (b.discordMenuState || 'Menüde'));
    const act = { details: details.slice(0, 128) || undefined, state: st.slice(0, 128) || undefined, timestamps: { start: Math.floor(startTs / 1000) } };
    if (b.discordImage) { act.assets = { large_image: String(b.discordImage), large_text: String(b.discordImageText || 'Cubixora Launcher') }; }
    if (b.discordButtonLabel && /^https?:\/\//.test(b.discordButtonUrl || '')) act.buttons = [{ label: String(b.discordButtonLabel).slice(0, 32), url: b.discordButtonUrl }];
    return { id, act };
  }

  async function push() {
    try {
      const s = (getSettings && getSettings()) || {};
      const w = await build();
      if (s.discordPresence === false || w.off) { if (ready) sock.write(frame(1, { cmd: 'SET_ACTIVITY', args: { pid: process.pid }, nonce: String(nonce++) })); return; }
      if (w.id && w.id !== clientId) { close(); clientId = w.id; connect(); return; }
      if (!clientId && w.id) { clientId = w.id; connect(); return; }
      if (!ready || !sock) return;
      sock.write(frame(1, { cmd: 'SET_ACTIVITY', args: { pid: process.pid, activity: w.act }, nonce: String(nonce++) }));
    } catch (e) { log && log('[discord] ' + e.message); }
  }

  return {
    start() { push(); },
    setGame(version, server, player) { state = { phase: 'game', version: version || '', server: server || '', player: player || '' }; startTs = Date.now(); push(); },
    setMenu() { state = { phase: 'menu', version: '', server: '', player: '' }; startTs = Date.now(); push(); },
    refresh: push,
    stop() { if (retry) clearTimeout(retry); retry = null; close(); },
  };
};
