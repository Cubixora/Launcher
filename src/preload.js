const { contextBridge, ipcRenderer } = require('electron');

const invoke = async (ch, ...args) => {
  const r = await ipcRenderer.invoke(ch, ...args);
  if (!r.ok) throw new Error(r.error);
  return r.data;
};

contextBridge.exposeInMainWorld('cx', {
  win: {
    minimize: () => ipcRenderer.send('win:minimize'),
    maximize: () => ipcRenderer.send('win:maximize'),
    close: () => ipcRenderer.send('win:close')
  },
  voiceState: (v) => ipcRenderer.send('voice:state', v),
  voiceDevices: (d) => ipcRenderer.send('voice:devices', d),
  voiceLog: (m) => ipcRenderer.send('voice:log', String(m).slice(0, 300)),
  state: () => invoke('state:get'),
  login: () => invoke('auth:login'),
  register: (data) => invoke('auth:register', data),
  upgradeMs: (kind, data) => invoke('auth:upgradeMs', kind, data),
  loginLocal: (data) => invoke('auth:local', data),
  loginSocial: (provider) => invoke('auth:social', provider),
  rename: (name) => invoke('auth:rename', name),
  resetPassword: (email) => invoke('auth:reset', email),
  resetConfirm: (p) => invoke('auth:resetConfirm', p),
  syncNow: () => invoke('sync:now'),
  cosmeticAssets: () => invoke('cosmetics:assets'),
  getCosmetics: () => invoke('cosmetics:get'),
  saveCosmetics: (c) => invoke('cosmetics:save', c),
  refreshCosmetics: () => invoke('cosmetics:refresh'),
  uploadMojangSkin: (url, slim) => invoke('skin:mojang', url, slim),
  playerSkin: () => invoke('skin:player'),
  logout: () => invoke('auth:logout'),
  versions: (snapshots) => invoke('versions:list', snapshots),
  fabricLoaders: (v) => invoke('fabric:loaders', v),
  saveProfile: (p) => invoke('profiles:save', p),
  deleteProfile: (id, files) => invoke('profiles:delete', id, files),
  selectProfile: (id) => invoke('profiles:select', id),
  openProfileFolder: (id) => invoke('profiles:openFolder', id),
  launch: (id) => invoke('game:launch', id),
  searchMods: (q) => invoke('mods:search', q),
  installMod: (pid, projectId) => invoke('mods:install', pid, projectId),
  listMods: (pid) => invoke('mods:list', pid),
  toggleMod: (pid, file) => invoke('mods:toggle', pid, file),
  deleteMod: (pid, file) => invoke('mods:delete', pid, file),
  saveSettings: (s) => invoke('settings:save', s),
  openData: () => invoke('shell:openData'),
  openUrl: (u) => invoke('shell:openUrl', u),
  setNick: (n) => invoke('auth:setNick', n),
  removeNick: (n) => invoke('auth:removeNick', n),
  linkMicrosoft: () => invoke('auth:linkMs'),
  unlinkMicrosoft: () => invoke('auth:unlinkMs'),
  social: (fn, ...args) => invoke('social:call', fn, ...args),
  content: (fn, ...args) => invoke('content:call', fn, ...args),
  installContent: (pid, projectId, type) => invoke('content:install', pid, projectId, type),
  addContentFiles: (pid, type) => invoke('content:addFiles', pid, type),
  openContentFolder: (pid, type) => invoke('content:openFolder', pid, type),
  importContent: (pid, dir, items) => invoke('content:import', pid, dir, items),
  optimize: (id) => invoke('content:optimize', id),
  launchServer: (pid, server, name) => invoke('game:launchServer', pid, server, name),
  killGame: () => invoke('game:kill'),
  cancelLaunch: () => invoke('game:cancelLaunch'),
  pingServer: (addr) => invoke('server:ping', addr),
  notify: (n) => invoke('notify:show', n),
  restart: () => invoke('app:restart'),
  checkUpdate: () => invoke('app:checkUpdate'),
  quit: () => invoke('app:quit'),
  pickImage: (o) => invoke('dialog:image', o),
  pick: (o) => invoke('dialog:pick', o),
  clearCache: () => invoke('storage:clearCache'),
  autologinAdd: (e) => invoke('settings:autologinAdd', e),
  autologinRemove: (i) => invoke('settings:autologinRemove', i),
  autologinList: () => invoke('settings:autologinList'),
  callHotkeys: (on) => invoke('call:hotkeys', on),
  publishInfo: () => invoke('admin:publishInfo'),
  previewInfo: () => invoke('app:previewInfo'),
  previewExit: () => invoke('preview:exit'),
  previewStart: (mode) => invoke('admin:previewStart', mode),
  previewState: () => invoke('admin:previewState'),
  on: (ch, fn) => {
    const allowed = ['log', 'progress', 'game-state', 'account', 'sync', 'social:me', 'social:signal', 'social:reward', 'social:quest', 'timed:expired', 'social:conn',
      'social:error', 'app:update', 'admin:publish', 'notify:click', 'call:hotkey', 'content:optimize', 'social:presence', 'cosmetics:changed', 'voice:want', 'voice:mute', 'voice:ctl', 'voice:devices-req', 'social:banned', 'preview:state', 'social:giveaways', 'admin:migrate'];
    if (!allowed.includes(ch)) return;
    ipcRenderer.on(ch, (_e, data) => fn(data));
  }
});
