// İçerik (mod / doku paketi / shader), Minecraft ayarları (options.txt), başka launcher'dan aktarma, oto-login
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const os = require('os');

const MODRINTH = 'https://api.modrinth.com/v2';
const TYPES = {
  mod: { folder: 'mods', facet: 'mod', ext: /\.jar(\.disabled)?$/i, loaders: (p) => [p.loader === 'fabric' ? 'fabric' : 'fabric'] },
  resourcepack: { folder: 'resourcepacks', facet: 'resourcepack', ext: /\.zip(\.disabled)?$/i, loaders: () => ['minecraft'] },
  shader: { folder: 'shaderpacks', facet: 'shader', ext: /\.zip(\.disabled)?$/i, loaders: () => ['iris', 'optifine'] }
};
const IRIS = 'YL57xq9U', SODIUM = 'AANobbMI';

module.exports = function createFeatures(ctx) {
  const { getJSON, downloadFile, profileDir, findProfile, log, send, unprotect, UA, getConfig } = ctx;

  // ------------------------------------------------------------ Modrinth arama
  async function search({ type = 'mod', query = '', mcVersion, offset = 0, sort }) {
    const T = TYPES[type]; if (!T) throw new Error('Bilinmeyen içerik türü');
    const facets = [[`project_type:${T.facet}`]];
    if (mcVersion) facets.push([`versions:${mcVersion}`]);
    if (type === 'mod') facets.push(['categories:fabric']);
    const index = sort || (query ? 'relevance' : 'downloads');
    const url = `${MODRINTH}/search?limit=20&offset=${offset}&index=${index}&query=${encodeURIComponent(query)}&facets=${encodeURIComponent(JSON.stringify(facets))}`;
    const r = await getJSON(url);
    return {
      total: r.total_hits,
      hits: r.hits.map((h) => ({ id: h.project_id, slug: h.slug, title: h.title, description: h.description, icon: h.icon_url,
        downloads: h.downloads, follows: h.follows, author: h.author, categories: h.display_categories || h.categories || [], type, gallery: h.featured_gallery || (h.gallery || [])[0] || null }))
    };
  }
  async function project(id) {
    const p = await getJSON(`${MODRINTH}/project/${encodeURIComponent(id)}`);
    return { id: p.id, title: p.title, description: p.description, body: p.body, icon: p.icon_url, downloads: p.downloads, followers: p.followers,
      gallery: (p.gallery || []).map((g) => g.url), categories: p.categories, source: p.source_url, wiki: p.wiki_url, discord: p.discord_url, type: p.project_type, updated: p.updated };
  }

  // ------------------------------------------------------------ kurulum
  async function install(profileId, projectId, type = 'mod', seen = new Set()) {
    const p = findProfile(profileId);
    if (!p) throw new Error('Profil bulunamadı.');
    const T = TYPES[type] || TYPES.mod;
    if (seen.has(projectId)) return [];
    seen.add(projectId);
    const loaders = type === 'mod' ? ['fabric'] : T.loaders(p);
    let versions = await getJSON(`${MODRINTH}/project/${projectId}/version?loaders=${encodeURIComponent(JSON.stringify(loaders))}&game_versions=${encodeURIComponent(JSON.stringify([p.version]))}`);
    if (!versions.length && type !== 'mod') versions = await getJSON(`${MODRINTH}/project/${projectId}/version?game_versions=${encodeURIComponent(JSON.stringify([p.version]))}`);
    if (!versions.length && type !== 'mod') versions = await getJSON(`${MODRINTH}/project/${projectId}/version`); // doku paketleri çoğu zaman sürümden bağımsızdır
    if (!versions.length) throw new Error(`Bu ${type === 'mod' ? 'mod' : type === 'shader' ? 'shader' : 'doku paketi'}, profilin sürümü (${p.version}) için uygun değil.`);
    const v = versions.find((x) => x.version_type === 'release') || versions[0];
    const file = v.files.find((f) => f.primary) || v.files[0];
    const dir = path.join(profileDir(p), T.folder);
    await downloadFile(file.url, path.join(dir, file.filename), file.hashes && file.hashes.sha1);
    if (ctx.rememberMod && file.hashes && file.hashes.sha1 && type === 'mod') ctx.rememberMod(file.hashes.sha1, { url: file.url, projectId: v.project_id, versionId: v.id });
    const installed = [file.filename];
    if (type === 'mod') {
      for (const dep of v.dependencies || []) {
        if (dep.dependency_type === 'required' && dep.project_id) {
          try { installed.push(...(await install(profileId, dep.project_id, 'mod', seen))); }
          catch (e) { log(`Bağımlılık kurulamadı (${dep.project_id}): ${e.message}`); }
        }
      }
    }
    // Fabric profilinde shader için Iris + Sodium gerekir
    if (type === 'shader' && p.loader === 'fabric') {
      for (const dep of [IRIS, SODIUM]) { try { installed.push(...(await install(profileId, dep, 'mod', seen))); } catch (e) { log(`Shader için ${dep} kurulamadı: ${e.message}`); } }
    }
    return installed;
  }

  // vanilla profilde shader varsa: oyun arka planda Fabric'le açıldığından Iris+Sodium o gizli klasöre konur
  async function ensureShaderSupport(p, addModsDir) {
    const sp = path.join(profileDir(p), 'shaderpacks');
    const has = (await fsp.readdir(sp).catch(() => [])).some((f) => /\.zip$/i.test(f));
    if (!has || p.loader === 'fabric') return false;
    for (const [id, name] of [[IRIS, 'iris'], [SODIUM, 'sodium']]) {
      const dest = path.join(addModsDir, `${name}.jar`);
      try {
        const versions = await getJSON(`${MODRINTH}/project/${id}/version?loaders=${encodeURIComponent('["fabric"]')}&game_versions=${encodeURIComponent(JSON.stringify([p.version]))}`);
        const v = versions.find((x) => x.version_type === 'release') || versions[0];
        if (!v) return false;
        const f = v.files.find((x) => x.primary) || v.files[0];
        await downloadFile(f.url, dest, f.hashes && f.hashes.sha1);
      } catch (e) { log(`[shader] ${name} indirilemedi: ${e.message}`); return false; }
    }
    return true;
  }

  async function list(profileId, type = 'mod') {
    const p = findProfile(profileId);
    if (!p) return [];
    const T = TYPES[type] || TYPES.mod;
    const dir = path.join(profileDir(p), T.folder);
    await fsp.mkdir(dir, { recursive: true });
    const out = [];
    for (const n of await fsp.readdir(dir)) {
      const full = path.join(dir, n);
      const st = await fsp.stat(full).catch(() => null);
      if (!st) continue;
      if (st.isDirectory() && type !== 'mod') { out.push({ file: n, name: n, enabled: true, size: 0, dir: true }); continue; }
      if (!T.ext.test(n)) continue;
      if (n.startsWith('cubixora-cosmetics')) continue;
      out.push({ file: n, name: n.replace(/\.disabled$/, '').replace(/\.(jar|zip)$/i, ''), enabled: !n.endsWith('.disabled'), size: st.size });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }
  async function toggle(profileId, type, file) {
    const dir = path.join(profileDir(findProfile(profileId)), (TYPES[type] || TYPES.mod).folder);
    const target = file.endsWith('.disabled') ? file.slice(0, -9) : file + '.disabled';
    await fsp.rename(path.join(dir, path.basename(file)), path.join(dir, path.basename(target)));
    return list(profileId, type);
  }
  async function remove(profileId, type, file) {
    await fsp.rm(path.join(profileDir(findProfile(profileId)), (TYPES[type] || TYPES.mod).folder, path.basename(file)), { force: true, recursive: true });
    return list(profileId, type);
  }
  async function addFiles(profileId, type, files) {
    const T = TYPES[type] || TYPES.mod;
    const dir = path.join(profileDir(findProfile(profileId)), T.folder);
    await fsp.mkdir(dir, { recursive: true });
    let n = 0;
    for (const f of files) {
      if (!T.ext.test(f)) continue;
      await fsp.copyFile(f, path.join(dir, path.basename(f)));
      n++;
    }
    return n;
  }
  const folderOf = (profileId, type) => path.join(profileDir(findProfile(profileId)), (TYPES[type] || TYPES.mod).folder);

  // ------------------------------------------------------------ options.txt
  function readOptions(profileId) {
    const f = path.join(profileDir(findProfile(profileId)), 'options.txt');
    if (!fs.existsSync(f)) return null;
    const out = {};
    for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
      const i = line.indexOf(':');
      if (i > 0) out[line.slice(0, i)] = line.slice(i + 1);
    }
    return out;
  }
  function writeOptions(profileId, patch) {
    const f = path.join(profileDir(findProfile(profileId)), 'options.txt');
    const cur = readOptions(profileId) || {};
    const next = { ...cur, ...patch };
    fs.writeFileSync(f, Object.entries(next).map(([k, v]) => `${k}:${v}`).join('\n') + '\n');
    return next;
  }

  // ------------------------------------------------------------ başka launcher'dan aktar
  // Kullanıcının seçtiği klasörü tarar (otomatik launcher tespiti yok)
  function importSources(picked) {
    if (!picked || !fs.existsSync(picked)) return [];
    const KEYS = ['options.txt', 'servers.dat', 'resourcepacks', 'shaderpacks', 'saves', 'mods'];
    const tries = [picked, path.join(picked, '.minecraft'), path.join(picked, 'minecraft'), path.join(picked, 'game')];
    const out = [];
    for (const dir of tries) {
      if (!fs.existsSync(dir)) continue;
      const items = KEYS.filter((x) => fs.existsSync(path.join(dir, x)));
      if (items.length) out.push({ name: path.basename(dir) || dir, dir, items });
    }
    return out;
  }
  async function copyDir(src, dest) {
    await fsp.mkdir(dest, { recursive: true });
    for (const e of await fsp.readdir(src, { withFileTypes: true })) {
      const s = path.join(src, e.name), d = path.join(dest, e.name);
      if (e.isDirectory()) await copyDir(s, d);
      else if (!fs.existsSync(d)) await fsp.copyFile(s, d);
    }
  }
  async function importFrom(profileId, dir, items) {
    const dest = profileDir(findProfile(profileId));
    await fsp.mkdir(dest, { recursive: true });
    const done = [];
    for (const it of items) {
      const src = path.join(dir, it);
      if (!fs.existsSync(src)) continue;
      const st = await fsp.stat(src);
      if (st.isDirectory()) await copyDir(src, path.join(dest, it));
      else await fsp.copyFile(src, path.join(dest, it));
      done.push(it);
    }
    return done;
  }

  // ------------------------------------------------------------ oto-login
  // Oyun açılırken o hesaba ait şifreler profilin config klasörüne yazılır, oyun okuyunca silinir.
  async function writeAutoLogin(gameDir, playerName) {
    const list = (getConfig().settings.autologin || []).filter((e) => !e.name || e.name.toLowerCase() === String(playerName).toLowerCase());
    const f = path.join(gameDir, 'config', 'cubixora', 'autologin.json');
    if (!list.length) { await fsp.rm(f, { force: true }); return 0; }
    const entries = list.map((e) => { let pass = ''; try { pass = unprotect(e.pass) || ''; } catch {} return { server: String(e.server || '').toLowerCase().trim(), name: e.name || '', pass }; }).filter((e) => e.pass);
    await fsp.mkdir(path.dirname(f), { recursive: true });
    await fsp.writeFile(f, JSON.stringify({ entries, written: Date.now() }));
    setTimeout(() => fsp.rm(f, { force: true }).catch(() => {}), 120000); // mod okuyup belleğe alır
    return entries.length;
  }

  // Cubixora profili: o sürüm için uygun olan performans modları (olmayan atlanır)
  const OPTIMIZE_PACK = [
    ['sodium', 'Sodium (görüntü motoru)'], ['lithium', 'Lithium (oyun mantığı)'], ['ferrite-core', 'FerriteCore (bellek)'],
    ['entityculling', 'Entity Culling (görünmeyenleri çizmez)'], ['immediatelyfast', 'ImmediatelyFast (arayüz/yazı)'],
    ['modernfix', 'ModernFix (açılış hızı)'], ['dynamic-fps', 'Dynamic FPS (arka planda FPS düşürür)'], ['moreculling', 'More Culling (bloklar)']
  ];
  async function optimize(profileId, onStep = () => {}) {
    const p = findProfile(profileId);
    if (!p) throw new Error('Profil bulunamadı.');
    if (p.loader !== 'fabric') throw new Error('Optimizasyon paketi Fabric profillerinde çalışır.');
    const done = [], skipped = [];
    const seen = new Set();
    for (let i = 0; i < OPTIMIZE_PACK.length; i++) {
      const [slug, label] = OPTIMIZE_PACK[i];
      onStep({ i, total: OPTIMIZE_PACK.length, label });
      try { await install(profileId, slug, 'mod', seen); done.push(label); }
      catch (e) { skipped.push(label); log(`[optimize] ${slug} atlandı: ${e.message}`); }
    }
    onStep({ i: OPTIMIZE_PACK.length, total: OPTIMIZE_PACK.length, label: '' });
    return { done, skipped };
  }

  return { optimize, OPTIMIZE_PACK, search, project, install, ensureShaderSupport, list, toggle, remove, addFiles, folderOf, readOptions, writeOptions, importSources, importFrom, writeAutoLogin, TYPES };
};
