-- =====================================================================================
-- Cubixora Launcher — Supabase veritabanı
--
-- KURULUM: Supabase paneli > SQL Editor > New query > bu dosyanın TAMAMINI yapıştır > Run.
-- Dosya tekrar çalıştırılabilir (veri silinmez; tablolar "if not exists", fonksiyonlar "or replace").
--
-- Tasarım
--  * Giriş Supabase Auth ile yapılır. Firebase'den taşınan hesaplar şifreleriyle birlikte gelir
--    (supabase/kullanicilar.sql) ve eski kimlikleri app_metadata.fbuid'de durur; veriler bu kimlikle eşleşir.
--  * Veriler tek bir "docs" tablosunda belge olarak tutulur (yol -> JSON). Launcher'daki
--    kod Firestore'daki gibi çalışmaya devam eder.
--  * İstemci tabloya DOĞRUDAN erişemez. Tüm okuma/yazma aşağıdaki fonksiyonlardan geçer ve
--    firestore.rules kurallarının birebir karşılığı olan fs_can_read / fs_can_write ile denetlenir
--    (coin, mağaza, çekiliş hilesine karşı).
--  * Anlık işler (çevrimiçi durumu, mesaj/arama sinyalleri, oyun içi emote/sprey) Supabase
--    Realtime özel kanallarıyla yapılır: presence, sig:<uid>, fx.
--  * Güncelleme paketleri GitHub Releases'tan iner; sürüm bilgisi config/app belgesindedir.
-- =====================================================================================

create table if not exists public.docs (
  path    text collate "C" primary key,
  parent  text collate "C" not null,
  id      text collate "C" not null,
  data    jsonb not null default '{}'::jsonb,
  created timestamptz not null default now(),
  updated timestamptz not null default now()
);
create index if not exists docs_parent_id on public.docs (parent, id);
create index if not exists docs_parent_at on public.docs (parent, (data -> 'at'));
create index if not exists docs_data on public.docs using gin (data jsonb_path_ops);
alter table public.docs enable row level security;   -- politika yok: doğrudan erişim tamamen kapalı
revoke all on public.docs from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then execute 'revoke all on public.docs from anon'; end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then execute 'revoke all on public.docs from authenticated'; end if;
end $$;

-- ---------------------------------------------------------------- yardımcılar
create or replace function public.fs_now() returns bigint
language sql stable as $$ select (extract(epoch from now()) * 1000)::bigint $$;

-- oturumdaki oyuncunun kimliği. Firebase'den taşınan hesaplarda eski kimlik (app_metadata.fbuid; yalnız sunucu yazabilir),
-- yeni hesaplarda Supabase kullanıcı kimliği. Böylece taşınan tüm veriler (profil, coin, arkadaşlık...) aynen çalışır.
create or replace function public.fs_uid() returns text
language sql stable as $$
  select case when coalesce(auth.jwt() ->> 'role', '') = 'authenticated' and nullif(auth.jwt() ->> 'sub', '') is not null
    then coalesce(nullif(auth.jwt() -> 'app_metadata' ->> 'fbuid', ''), auth.jwt() ->> 'sub') end
$$;

create or replace function public.fs_n(j jsonb) returns numeric
language sql immutable as $$ select case when jsonb_typeof(j) = 'number' then (j #>> '{}')::numeric end $$;

create or replace function public.fs_s(j jsonb) returns text
language sql immutable as $$ select case when jsonb_typeof(j) = 'string' then j #>> '{}' end $$;

create or replace function public.fs_len(j jsonb) returns int
language sql immutable as $$ select case when j is null or jsonb_typeof(j) = 'null' then 0 when jsonb_typeof(j) = 'string' then char_length(j #>> '{}') else 1000000000 end $$;

-- değişen alanlar (eklenen, silinen ya da değeri değişen)
create or replace function public.fs_changed(o jsonb, n jsonb) returns text[]
language sql immutable as $$
  select coalesce(array_agg(k), '{}') from (
    select jsonb_object_keys(coalesce(o, '{}'::jsonb)) k union select jsonb_object_keys(coalesce(n, '{}'::jsonb))
  ) x where (o -> k) is distinct from (n -> k)
$$;

create or replace function public.fs_keys(j jsonb) returns text[]
language sql immutable as $$ select coalesce(array_agg(k), '{}') from jsonb_object_keys(coalesce(j, '{}'::jsonb)) k $$;

-- a dizisinde olup b'de olmayan (tekil) metinler
create or replace function public.fs_minus(a jsonb, b jsonb) returns text[]
language sql immutable as $$
  select coalesce(array_agg(distinct x), '{}') from jsonb_array_elements_text(case when jsonb_typeof(a) = 'array' then a else '[]'::jsonb end) x
  where not coalesce(case when jsonb_typeof(b) = 'array' then b else '[]'::jsonb end ? x, false)
$$;

create or replace function public.fs_has(arr jsonb, v text) returns boolean
language sql immutable as $$ select coalesce(jsonb_typeof(arr) = 'array' and arr ? v, false) $$;

create or replace function public.fs_size(arr jsonb) returns int
language sql immutable as $$ select case when jsonb_typeof(arr) = 'array' then jsonb_array_length(arr) when jsonb_typeof(arr) = 'object' then (select count(*)::int from jsonb_object_keys(arr)) else 0 end $$;

-- belgenin şu anki hali (yazma sırasında: yazıldıktan SONRAKİ hali = Firestore getAfter)
create or replace function public.fs_doc(p text) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$ select data from public.docs where path = p $$;

-- belgenin yazmadan ÖNCEKİ hali (Firestore get/exists). Yazma dışında şu anki hali döner.
create or replace function public.fs_before(p text) returns jsonb
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare r record;
begin
  if to_regclass('pg_temp.fs_pre') is not null then
    execute 'select data, existed from pg_temp.fs_pre where path = $1' into r using p;
    if r.existed is not null then return case when r.existed then r.data end; end if;
  end if;
  return (select data from public.docs where path = p);
end $$;

create or replace function public.fs_pair(a text, b text) returns text
language sql immutable as $$ select case when a collate "C" < b collate "C" then a || '_' || b else b || '_' || a end $$;

create or replace function public.fs_roles(u text) returns jsonb
language sql volatile as $$ select coalesce(public.fs_before('profiles/' || u) -> 'roles', '[]'::jsonb) $$;

-- Admin: kurucu e-postası (doğrulanmış) ya da profilinde "founder" rütbesi olan herkes
create or replace function public.fs_is_admin() returns boolean
language sql volatile security definer set search_path = public, pg_temp as $$
  select public.fs_uid() is not null and (
    exists (select 1 from auth.users u where u.id::text = auth.jwt() ->> 'sub'
            and lower(u.email) = 'cubixora@gmail.com' and u.email_confirmed_at is not null)
    or public.fs_has(public.fs_roles(public.fs_uid()), 'founder'))
$$;

create or replace function public.fs_boost(u text) returns int
language sql volatile as $$ select case when public.fs_roles(u) ?| array['founder', 'partner', 'plus'] then 2 else 1 end $$;

create or replace function public.fs_cfg(name text) returns jsonb
language sql volatile as $$ select coalesce(public.fs_before('config/' || name), '{}'::jsonb) $$;

create or replace function public.fs_friends(a text, b text) returns boolean
language sql volatile as $$ select public.fs_before('friendships/' || public.fs_pair(a, b)) is not null $$;

-- eşya sahipliği (ücretsizler, admin "herkese ver", envanter, süreli görev ödülleri)
create or replace function public.fs_owns(item text) returns boolean
language plpgsql volatile as $$
declare me text := public.fs_uid(); g jsonb; t jsonb;
begin
  if me is null then return false; end if;
  if item in ('cape-cubixora', 'emote-opucuk', 'spray-logo') then return true; end if;
  g := public.fs_cfg('shop') -> 'items' -> item;
  if g is not null and (g ->> 'give' = 'all' or (g ->> 'give' = 'allTimed' and coalesce(public.fs_n(g -> 'giveUntil'), 0) > public.fs_now())) then return true; end if;
  if (public.fs_before('inventory/' || me) -> 'items' -> item) = 'true'::jsonb then return true; end if;
  t := public.fs_before('timed/' || me || '/items/' || item);
  return coalesce(public.fs_n(t -> 'until'), 0) > public.fs_now();
end $$;

create or replace function public.fs_owns_or_empty(v jsonb, prefix text) returns boolean
language sql volatile as $$ select v is null or jsonb_typeof(v) = 'null' or v = '""'::jsonb or (jsonb_typeof(v) = 'string' and public.fs_owns(prefix || (v #>> '{}'))) $$;

-- ---------------------------------------------------------------- okuma kuralı
create or replace function public.fs_can_read(p text, d jsonb, is_list boolean) returns boolean
language plpgsql volatile as $$
declare s text[] := string_to_array(p, '/'); n int := coalesce(array_length(s, 1), 0); c text := s[1]; me text := public.fs_uid();
begin
  if public.fs_is_admin() then return true; end if;
  if n = 2 and c in ('config', 'news', 'bundle', 'usernames', 'handles', 'emotes', 'sprays', 'cosmetics') then return true; end if;
  if me is null then return false; end if;
  if n = 2 then
    if c in ('notifications', 'profiles', 'giveaways', 'wallets', 'inventory') then return true; end if;
    if c in ('giftCodes', 'betaKeys', 'bannedEmails') then return not is_list; end if;
    if c in ('users', 'emails', 'privates') then return s[2] = me; end if;
    if c = 'friendRequests' then return d ->> 'from' = me or d ->> 'to' = me; end if;
    if c in ('friendships', 'chats', 'groups', 'calls') then return public.fs_has(d -> 'members', me); end if;
    return false;
  end if;
  if n = 4 then
    if c = 'inbox' and s[3] = 'items' then return s[2] = me; end if;
    if c in ('claims', 'timed', 'activity') and s[3] = 'items' then return true; end if;
    if c = 'giveaways' and s[3] = 'entries' then return s[4] = me; end if;
    if c in ('chats', 'groups') and s[3] = 'messages' then return public.fs_has(public.fs_doc(c || '/' || s[2]) -> 'members', me); end if;
    if c = 'calls' and s[3] = 'candidates' then return public.fs_has(public.fs_doc('calls/' || s[2]) -> 'members', me); end if;
  end if;
  return false;
end $$;

-- ---------------------------------------------------------------- yazma kuralı (firestore.rules karşılığı)
create or replace function public.fs_valid_profile(d jsonb) returns boolean
language sql volatile as $$
  select jsonb_typeof(d -> 'displayName') = 'string' and fs_len(d -> 'displayName') between 1 and 24
    and jsonb_typeof(d -> 'handle') = 'string'
    and public.fs_doc('handles/' || lower(d ->> 'handle')) ->> 'uid' = public.fs_uid()
    and fs_len(d -> 'statusMsg') <= 160
    and fs_len(d -> 'bg') <= 700000
    and fs_len(d -> 'avatar') <= 20000
    and public.fs_owns_or_empty(d -> 'frame', 'frame-')
    and public.fs_owns_or_empty(d -> 'color', 'color-')
$$;

create or replace function public.fs_valid_message(d jsonb) returns boolean
language sql immutable as $$ select fs_len(d -> 'text') <= 2000 and fs_len(d -> 'image') <= 950000 and fs_len(d -> 'audio') <= 950000 $$;

-- cüzdan işlemi: her ödül/satın alma claims/{uid}/items/{lastOp} ile BİR KEZ ve tam miktarda
create or replace function public.fs_valid_op(u text, o jsonb, n jsonb) returns boolean
language plpgsql volatile as $$
declare op text := n ->> 'lastOp'; kind text; id text; dc numeric; dl numeric; cp text; x jsonb; lv int;
begin
  if op is null then return false; end if;
  kind := split_part(op, ':', 1); id := split_part(op, ':', 2);
  cp := 'claims/' || u || '/items/' || op;
  dc := public.fs_n(n -> 'coins') - public.fs_n(o -> 'coins');
  dl := public.fs_n(n -> 'lp') - public.fs_n(o -> 'lp');
  if not (public.fs_changed(o, n) <@ array['coins', 'lp', 'lastOp']) then return false; end if;
  if public.fs_before(cp) is not null or public.fs_doc(cp) is null then return false; end if;
  if coalesce(public.fs_n(n -> 'coins'), -1) < 0 or dc is null or dl is null then return false; end if;
  if kind = 'ach' then
    x := public.fs_cfg('achievements') -> 'list' -> id;
    return x is not null and dc = public.fs_n(x -> 'coins') and dl = coalesce(public.fs_n(x -> 'lp'), 0);
  elsif kind = 'time' then
    if id !~ '^[0-9]+$' then return false; end if;
    x := public.fs_cfg('rewards');
    return id::bigint = floor(public.fs_now() / 3600000)
      and dc = coalesce(public.fs_n(x -> 'hourly'), -1) * public.fs_boost(u)
      and dl = coalesce(public.fs_n(x -> 'hourlyLp'), 1) * public.fs_boost(u);
  elsif kind = 'qst' then
    x := public.fs_cfg('quests') -> 'events' -> split_part(id, '_', 1) -> 'steps' -> split_part(id, '_', 2);
    return x is not null and dc = public.fs_n(x -> 'coins') and dl = coalesce(public.fs_n(x -> 'lp'), 0);
  elsif kind = 'qrw' then
    return dc = 0 and dl = 0 and jsonb_typeof(public.fs_cfg('quests') -> 'events' -> id -> 'rewardItem') = 'string';
  elsif kind = 'lvl' then
    if id !~ '^[0-9]{1,6}$' then return false; end if;
    lv := id::int;
    return dl = 0 and 50::bigint * lv * (lv - 1) <= coalesce(public.fs_n(o -> 'lp'), 0) and dc = (case when lv % 5 = 0 then 50 else 10 end);
  elsif kind = 'gift' then
    x := public.fs_before('giftCodes/' || id);
    return x is not null and x -> 'active' = 'true'::jsonb and dc = public.fs_n(x -> 'coins') and dl = 0;
  elsif kind = 'buy' then
    x := public.fs_cfg('shop') -> 'items' -> id;
    return x is not null and dc = -public.fs_n(x -> 'price') and dl = 0
      and (public.fs_doc('inventory/' || u) -> 'items' -> id) = 'true'::jsonb;
  end if;
  return false;
end $$;

create or replace function public.fs_can_write(p text, o jsonb, n jsonb) returns boolean
language plpgsql volatile as $$
declare
  s text[] := string_to_array(p, '/'); cnt int := coalesce(array_length(s, 1), 0); c text := s[1];
  me text := public.fs_uid(); op text; ch text[]; x jsonb; y jsonb; m0 text; m1 text; lastop text; added text[];
begin
  if me is null then return false; end if;
  if public.fs_is_admin() then return true; end if;
  op := case when o is null then 'create' when n is null then 'delete' else 'update' end;
  ch := public.fs_changed(o, n);

  if cnt = 2 then
    -- yalnız admin yazar
    if c in ('config', 'news', 'bundle', 'notifications', 'giftCodes', 'betaKeys', 'bannedEmails', 'reports') then
      if c = 'reports' and op = 'create' then
        return public.fs_keys(n) <@ array['uid', 'name', 'category', 'text', 'version', 'status', 'at']
          and n ->> 'uid' = me and jsonb_typeof(n -> 'text') = 'string' and fs_len(n -> 'text') <= 1500
          and public.fs_n(n -> 'at') = public.fs_now();
      end if;
      return false;
    end if;
    if c in ('users', 'emails', 'privates') then return s[2] = me; end if;
    if c = 'usernames' then
      if op = 'create' then return n ->> 'uid' = me; end if;
      if op = 'delete' then return o ->> 'uid' = me; end if;
      return false;
    end if;
    if c = 'handles' then
      if op = 'create' then return n ->> 'uid' = me and s[2] ~ '^[a-z0-9_.]{3,20}$'; end if;
      if op = 'delete' then return o ->> 'uid' = me; end if;
      return false;
    end if;
    if c in ('emotes', 'sprays', 'cosmetics') then
      if op = 'delete' then return o ->> 'uid' = me; end if;
      if public.fs_before('usernames/' || s[2]) ->> 'uid' is distinct from me or n ->> 'uid' is distinct from me then return false; end if;
      if c = 'emotes' then
        return public.fs_keys(n) <@ array['uid', 'name', 'id', 't'] and coalesce(n ->> 'id', '#') in ('', 'kiss');
      elsif c = 'sprays' then
        return public.fs_keys(n) <@ array['uid', 'name', 'x', 'y', 'z', 'd', 'r', 't']
          and jsonb_typeof(n -> 'd') = 'number' and public.fs_n(n -> 'd') = trunc(public.fs_n(n -> 'd')) and public.fs_n(n -> 'd') between 0 and 5;
      end if;
      return public.fs_owns_or_empty(n -> 'cape', 'cape-') and public.fs_owns_or_empty(n -> 'wings', 'wings-')
        and public.fs_owns_or_empty(n -> 'hat', 'hat-') and public.fs_owns_or_empty(n -> 'fly', 'fpet-')
        and public.fs_owns_or_empty(n -> 'effect', 'effect-')
        and (coalesce(n -> 'pet', 'false'::jsonb) = 'false'::jsonb or public.fs_owns('pet-mini'))
        and fs_len(n -> 'skin') <= 70000 and fs_len(n -> 'capeTex') <= 280000 and fs_len(n -> 'wingsTex') <= 120000;
    end if;
    if c = 'profiles' then
      if op = 'delete' or s[2] <> me then return false; end if;
      if not public.fs_valid_profile(n) then return false; end if;
      if op = 'create' then
        return public.fs_size(n -> 'roles') = 0 and public.fs_n(n -> 'displayNameAt') = public.fs_now() and public.fs_n(n -> 'handleAt') = public.fs_now();
      end if;
      return not (ch && array['banned', 'badges', 'created'])
        and (not ('roles' = any (ch))
          or (public.fs_minus(n -> 'roles', o -> 'roles') = array['plus'] and cardinality(public.fs_minus(o -> 'roles', n -> 'roles')) = 0 and public.fs_owns('plus-cubixora'))
          or (public.fs_minus(o -> 'roles', n -> 'roles') = array['plus'] and cardinality(public.fs_minus(n -> 'roles', o -> 'roles')) = 0
              and coalesce(public.fs_n(o -> 'plusUntil'), 0) > 0 and coalesce(public.fs_n(o -> 'plusUntil'), 0) < public.fs_now()))
        and (not ('plusUntil' = any (ch)) or (public.fs_n(n -> 'plusUntil') = 0 and public.fs_owns('plus-cubixora')))
        and (not ('displayName' = any (ch)) or (public.fs_n(n -> 'displayNameAt') = public.fs_now()
              and public.fs_now() > coalesce(public.fs_n(o -> 'displayNameAt'), 0) + 15::bigint * 86400000))
        and (not ('handle' = any (ch)) or (public.fs_n(n -> 'handleAt') = public.fs_now()
              and public.fs_now() > coalesce(public.fs_n(o -> 'handleAt'), 0) + 30::bigint * 86400000))
        and (not ('displayNameAt' = any (ch)) or 'displayName' = any (ch))
        and (not ('handleAt' = any (ch)) or 'handle' = any (ch));
    end if;
    if c = 'giveaways' then
      if op <> 'update' then return false; end if;
      return ch <@ array['entries'] and public.fs_n(n -> 'entries') = coalesce(public.fs_n(o -> 'entries'), 0) + 1
        and public.fs_before(p || '/entries/' || me) is null and public.fs_doc(p || '/entries/' || me) is not null;
    end if;
    if c = 'wallets' then
      if s[2] <> me then return false; end if;
      if op = 'create' then return public.fs_n(n -> 'coins') = 0 and public.fs_n(n -> 'lp') = 0; end if;
      if op = 'update' then return public.fs_valid_op(me, o, n); end if;
      return false;
    end if;
    if c = 'inventory' then
      if s[2] <> me then return false; end if;
      if op = 'create' then return jsonb_typeof(n -> 'items') = 'object' and public.fs_size(n -> 'items') = 0; end if;
      if op <> 'update' or not (ch <@ array['items']) then return false; end if;
      -- eşya silinemez/değiştirilemez; eklenenler bu işlemde satın alındı ya da hediye kodundan geldi
      if exists (select 1 from jsonb_each(coalesce(o -> 'items', '{}'::jsonb)) e where (n -> 'items' -> e.key) is distinct from e.value) then return false; end if;
      select coalesce(array_agg(k), '{}') into added from jsonb_object_keys(coalesce(n -> 'items', '{}'::jsonb)) k where not coalesce(o -> 'items', '{}'::jsonb) ? k;
      lastop := public.fs_doc('wallets/' || me) ->> 'lastOp';
      if split_part(lastop, ':', 1) = 'buy' then return added = array[split_part(lastop, ':', 2)]; end if;
      if split_part(lastop, ':', 1) = 'gift' then
        x := coalesce(public.fs_before('giftCodes/' || split_part(lastop, ':', 2)) -> 'items', '[]'::jsonb);
        return not exists (select 1 from unnest(added) a where not public.fs_has(x, a));
      end if;
      return false;
    end if;
    if c = 'friendRequests' then
      if op = 'create' then
        return n ->> 'from' = me and n ->> 'to' is distinct from me and s[2] = me || '_' || (n ->> 'to') and public.fs_n(n -> 'at') = public.fs_now();
      end if;
      if op = 'delete' then return o ->> 'from' = me or o ->> 'to' = me; end if;
      return false;
    end if;
    if c = 'friendships' then
      if op = 'delete' then return public.fs_has(o -> 'members', me); end if;
      if op <> 'create' then return false; end if;
      m0 := n -> 'members' ->> 0; m1 := n -> 'members' ->> 1;
      return public.fs_has(n -> 'members', me) and public.fs_size(n -> 'members') = 2 and s[2] = m0 || '_' || m1
        and m0 collate "C" < m1 collate "C"
        and public.fs_before('friendRequests/' || (case when m0 = me then m1 else m0 end) || '_' || me) is not null;
    end if;
    if c = 'chats' then
      if op = 'create' then
        m0 := n -> 'members' ->> 0; m1 := n -> 'members' ->> 1;
        return public.fs_has(n -> 'members', me) and public.fs_size(n -> 'members') = 2 and s[2] = m0 || '_' || m1 and public.fs_friends(m0, m1);
      end if;
      if op = 'update' then return public.fs_has(o -> 'members', me) and ch <@ array['lastText', 'lastAt', 'lastFrom', 'reads']; end if;
      return false;
    end if;
    if c = 'groups' then
      if op = 'create' then return n ->> 'owner' = me and public.fs_has(n -> 'members', me) and public.fs_size(n -> 'members') <= 50; end if;
      if op = 'delete' then return o ->> 'owner' = me; end if;
      if not public.fs_has(o -> 'members', me) then return false; end if;
      return (o ->> 'owner' = me and public.fs_has(n -> 'members', n ->> 'owner') and public.fs_size(n -> 'members') <= 50)
        or (ch <@ array['members'] and o -> 'settings' -> 'canInvite' = 'true'::jsonb
            and cardinality(public.fs_minus(o -> 'members', n -> 'members')) = 0 and public.fs_size(n -> 'members') <= 50)
        or (ch <@ array['members'] and public.fs_minus(o -> 'members', n -> 'members') = array[me]
            and cardinality(public.fs_minus(n -> 'members', o -> 'members')) = 0)
        or (ch <@ array['lastText', 'lastAt', 'lastFrom'] and (o -> 'settings' -> 'canMessage' = 'true'::jsonb or o ->> 'owner' = me));
    end if;
    if c = 'calls' then
      if op in ('update', 'delete') then return public.fs_has(o -> 'members', me); end if;
      m0 := n -> 'members' ->> 0; m1 := n -> 'members' ->> 1;
      return n ->> 'caller' = me and public.fs_has(n -> 'members', me) and public.fs_size(n -> 'members') = 2 and public.fs_friends(m0, m1);
    end if;
    return false;
  end if;

  if cnt = 4 then
    if c = 'inbox' and s[3] = 'items' then
      if s[2] <> me then return false; end if;
      if op = 'delete' then return true; end if;
      if op = 'update' then return ch <@ array['read']; end if;
      return false;
    end if;
    if c = 'claims' and s[3] = 'items' then
      return op = 'create' and s[2] = me and public.fs_n(n -> 'at') = public.fs_now() and public.fs_doc('wallets/' || me) ->> 'lastOp' = s[4];
    end if;
    if c = 'activity' and s[3] = 'items' then
      if s[2] <> me then return false; end if;
      if op = 'create' then return public.fs_n(n -> 'at') = public.fs_now(); end if;
      return op = 'delete';
    end if;
    if c = 'timed' and s[3] = 'items' then
      if s[2] <> me then return false; end if;
      if op = 'delete' then return true; end if;
      if not (public.fs_keys(n) <@ array['until', 'event', 'at']) then return false; end if;
      if op = 'update' and coalesce(public.fs_n(o -> 'until'), 0) >= public.fs_now() then return false; end if;
      lastop := public.fs_doc('wallets/' || me) ->> 'lastOp';
      x := public.fs_cfg('quests') -> 'events' -> split_part(lastop, ':', 2);
      return split_part(lastop, ':', 1) = 'qrw' and x ->> 'rewardItem' = s[4] and n ->> 'event' = split_part(lastop, ':', 2)
        and public.fs_n(n -> 'until') > public.fs_now()
        and public.fs_n(n -> 'until') <= public.fs_now() + coalesce(public.fs_n(x -> 'rewardDays'), 7) * 86400000 + 120000;
    end if;
    if c = 'giveaways' and s[3] = 'entries' then
      if op <> 'create' or s[4] <> me then return false; end if;
      x := public.fs_before('giveaways/' || s[2]); y := public.fs_doc('giveaways/' || s[2]);
      return public.fs_keys(n) <@ array['uid', 'name', 'at'] and n ->> 'uid' = me
        and jsonb_typeof(n -> 'name') = 'string' and fs_len(n -> 'name') <= 24
        and x ->> 'status' = 'open' and public.fs_now() < coalesce(public.fs_n(x -> 'drawAt'), 0)
        and public.fs_n(y -> 'entries') = coalesce(public.fs_n(x -> 'entries'), 0) + 1;
    end if;
    if c in ('chats', 'groups') and s[3] = 'messages' then
      x := public.fs_before(c || '/' || s[2]);
      if op = 'create' then
        return n ->> 'from' = me and public.fs_has(x -> 'members', me) and public.fs_n(n -> 'at') = public.fs_now()
          and public.fs_valid_message(n)
          and (c = 'chats' or x -> 'settings' -> 'canMessage' = 'true'::jsonb or x ->> 'owner' = me);
      end if;
      return o ->> 'from' = me or (c = 'groups' and x ->> 'owner' = me);
    end if;
    if c = 'calls' and s[3] = 'candidates' then
      return op = 'create' and public.fs_has(public.fs_before('calls/' || s[2]) -> 'members', me);
    end if;
  end if;
  return false;
end $$;

-- ---------------------------------------------------------------- istemci fonksiyonları
create or replace function public.fs_path_ok(p text) returns boolean
language sql immutable as $$
  select p is not null and char_length(p) <= 1500 and p ~ '^[^/]+(/[^/]+)*$'
    and array_length(string_to_array(p, '/'), 1) % 2 = 0 and p !~ '(^|/)\.\.?(/|$)'
$$;

-- belge(ler)i oku: okunamayan ya da olmayanlar dönmez. omit: dönmeyecek büyük alanlar (ör. profil arka planı)
drop function if exists public.fs_get(text[]);
create or replace function public.fs_get(paths text[], omit text[] default '{}')
returns table (path text, data jsonb, updated bigint)
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare adm boolean := public.fs_is_admin();
begin
  if cardinality(paths) > 300 then raise exception 'INVALID_ARGUMENT'; end if;
  return query select d.path::text, d.data - coalesce(omit, '{}'), (extract(epoch from d.updated) * 1000)::bigint
    from public.docs d where d.path = any (paths) and (adm or public.fs_can_read(d.path, d.data, false));
end $$;

-- sadece son değişiklik zamanları (önbellekteki kopya hâlâ güncel mi? veri indirmeden kontrol)
create or replace function public.fs_stamps(paths text[])
returns table (path text, updated bigint)
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare adm boolean := public.fs_is_admin();
begin
  if cardinality(paths) > 300 then raise exception 'INVALID_ARGUMENT'; end if;
  return query select d.path::text, (extract(epoch from d.updated) * 1000)::bigint
    from public.docs d where d.path = any (paths) and (adm or public.fs_can_read(d.path, d.data, false));
end $$;

-- sorgu: filters = [[alan, 'EQUAL'|'ARRAY_CONTAINS'|'GREATER_THAN'|..., değer], ...], orders = [[alan, 'asc'|'desc'], ...]
drop function if exists public.fs_query(text, jsonb, jsonb, integer, text);
create or replace function public.fs_query(col text, filters jsonb default '[]'::jsonb, orders jsonb default '[]'::jsonb, lim int default null, start_after text default null, omit text[] default '{}')
returns table (path text, data jsonb, updated bigint)
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  adm boolean := public.fs_is_admin(); me text := public.fs_uid();
  w text; ob text := ''; f jsonb; fld text; op text; v jsonb; sym text; dir text; per_row boolean := true; segs text[];
begin
  if not public.fs_path_ok(col || '/x') then raise exception 'INVALID_ARGUMENT'; end if;
  w := format('d.parent = %L', col);
  segs := string_to_array(col, '/');
  if not adm then
    -- sohbet/grup mesajları: üyelik bir kez denetlenir
    if array_length(segs, 1) = 3 and segs[1] in ('chats', 'groups') and segs[3] = 'messages' then
      if me is null or not public.fs_has(public.fs_doc(segs[1] || '/' || segs[2]) -> 'members', me) then return; end if;
      per_row := false;
    end if;
  else per_row := false; end if;
  for f in select * from jsonb_array_elements(coalesce(filters, '[]'::jsonb)) loop
    fld := f ->> 0; op := f ->> 1; v := f -> 2;
    if fld !~ '^[A-Za-z0-9_]+$' then raise exception 'INVALID_ARGUMENT'; end if;
    if op = 'EQUAL' then
      if jsonb_typeof(v) in ('string', 'number', 'boolean') then w := w || format(' and d.data @> %L::jsonb', jsonb_build_object(fld, v));
      else w := w || format(' and d.data -> %L = %L::jsonb', fld, v); end if;
    elsif op = 'NOT_EQUAL' then w := w || format(' and d.data ? %L and d.data -> %L <> %L::jsonb', fld, fld, v);
    elsif op = 'ARRAY_CONTAINS' then w := w || format(' and d.data @> %L::jsonb', jsonb_build_object(fld, jsonb_build_array(v)));
    elsif op = 'IN' then w := w || format(' and d.data -> %L = any (array(select jsonb_array_elements(%L::jsonb)))', fld, v);
    elsif op in ('GREATER_THAN', 'GREATER_THAN_OR_EQUAL', 'LESS_THAN', 'LESS_THAN_OR_EQUAL') then
      sym := case op when 'GREATER_THAN' then '>' when 'GREATER_THAN_OR_EQUAL' then '>=' when 'LESS_THAN' then '<' else '<=' end;
      if jsonb_typeof(v) = 'number' then
        w := w || format(' and jsonb_typeof(d.data -> %L) = ''number'' and (d.data ->> %L)::numeric %s %s', fld, fld, sym, (v #>> '{}')::numeric);
      elsif jsonb_typeof(v) = 'string' then
        w := w || format(' and jsonb_typeof(d.data -> %L) = ''string'' and (d.data ->> %L) collate "C" %s %L collate "C"', fld, fld, sym, v #>> '{}');
      else raise exception 'INVALID_ARGUMENT'; end if;
    else raise exception 'INVALID_ARGUMENT'; end if;
  end loop;
  for f in select * from jsonb_array_elements(coalesce(orders, '[]'::jsonb)) loop
    fld := f ->> 0; dir := case when lower(coalesce(f ->> 1, 'asc')) = 'desc' then 'desc' else 'asc' end;
    if fld !~ '^[A-Za-z0-9_]+$' then raise exception 'INVALID_ARGUMENT'; end if;
    w := w || format(' and d.data ? %L', fld);   -- Firestore: sıralama alanı olmayan belgeler sonuçta yer almaz
    ob := ob || case when ob = '' then '' else ', ' end
      || format('public.fs_n(d.data -> %L) %s nulls last, (d.data ->> %L) collate "C" %s', fld, dir, fld, dir);
  end loop;
  if start_after is not null then w := w || format(' and d.id > %L collate "C"', start_after); end if;
  ob := ob || case when ob = '' then '' else ', ' end || 'd.id';
  if per_row then w := w || ' and public.fs_can_read(d.path, d.data, true)'; end if;
  return query execute format('select d.path::text, d.data - %L::text[], (extract(epoch from d.updated) * 1000)::bigint from public.docs d where %s order by %s limit %s',
    coalesce(omit, '{}'), w, ob, least(coalesce(lim, 1000), 1000));
end $$;

-- iç içe alana değer yaz (ara nesneler yoksa oluşturulur)
create or replace function public.fs_set_path(d jsonb, kp text[], v jsonb) returns jsonb
language plpgsql immutable as $$
declare cur jsonb;
begin
  if cardinality(kp) = 1 then return coalesce(d, '{}'::jsonb) || jsonb_build_object(kp[1], v); end if;
  cur := coalesce(d, '{}'::jsonb) -> kp[1];
  if jsonb_typeof(cur) is distinct from 'object' then cur := '{}'::jsonb; end if;
  return coalesce(d, '{}'::jsonb) || jsonb_build_object(kp[1], public.fs_set_path(cur, kp[2:], v));
end $$;

-- toplu yazma (tek işlem). writes = [{ set, data, mask?, exists?, increments?, serverTime? } | { delete }]
create or replace function public.fs_commit(writes jsonb)
returns jsonb
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare w jsonb; p text; cur jsonb; ex boolean; nd jsonb; k text; v jsonb; kp text[]; t bigint := public.fs_now(); r record; segs text[];
begin
  if public.fs_uid() is null then raise exception 'PERMISSION_DENIED'; end if;
  if jsonb_typeof(writes) <> 'array' or jsonb_array_length(writes) = 0 or jsonb_array_length(writes) > 500 then raise exception 'INVALID_ARGUMENT'; end if;
  if to_regclass('pg_temp.fs_pre') is not null then drop table pg_temp.fs_pre; end if;
  create temp table fs_pre (path text collate "C" primary key, data jsonb, existed boolean) on commit drop;
  -- önceki halleri kilitleyerek al (Firestore get/exists bunlara bakar)
  for w in select * from jsonb_array_elements(writes) loop
    p := coalesce(w ->> 'delete', w ->> 'set');
    if not public.fs_path_ok(p) then raise exception 'INVALID_ARGUMENT'; end if;
    if not exists (select 1 from pg_temp.fs_pre f where f.path = p) then
      select d.data into cur from public.docs d where d.path = p for update;
      insert into pg_temp.fs_pre values (p, cur, found);
    end if;
  end loop;
  -- uygula (sırayla; aynı belgeye yapılan art arda yazmalar birbirini görür)
  for w in select * from jsonb_array_elements(writes) loop
    if w ? 'delete' then delete from public.docs d where d.path = w ->> 'delete'; continue; end if;
    p := w ->> 'set';
    select d.data into cur from public.docs d where d.path = p; ex := found;
    if w ? 'exists' and jsonb_typeof(w -> 'exists') = 'boolean' then
      if (w ->> 'exists')::boolean and not ex then raise exception 'NOT_FOUND'; end if;
      if not (w ->> 'exists')::boolean and ex then raise exception 'ALREADY_EXISTS'; end if;
    end if;
    if jsonb_typeof(w -> 'data') is distinct from 'object' and w ? 'data' then raise exception 'INVALID_ARGUMENT'; end if;
    if w ? 'mask' then
      -- mask: alan yolları ([["items","cape-x"], ["lastOp"]]); verilmeyen alan silinir
      nd := coalesce(cur, '{}'::jsonb);
      for v in select * from jsonb_array_elements(w -> 'mask') loop
        kp := array(select jsonb_array_elements_text(case when jsonb_typeof(v) = 'array' then v else jsonb_build_array(v) end));
        if cardinality(kp) = 0 or cardinality(kp) > 10 then raise exception 'INVALID_ARGUMENT'; end if;
        if (w -> 'data') #> kp is not null then nd := public.fs_set_path(nd, kp, (w -> 'data') #> kp); else nd := nd #- kp; end if;
      end loop;
    else nd := coalesce(w -> 'data', '{}'::jsonb); end if;
    for k, v in select * from jsonb_each(coalesce(w -> 'increments', '{}'::jsonb)) loop
      if jsonb_typeof(v) <> 'number' then raise exception 'INVALID_ARGUMENT'; end if;
      nd := nd || jsonb_build_object(k, coalesce(public.fs_n(nd -> k), 0) + (v #>> '{}')::numeric);
    end loop;
    for k in select jsonb_array_elements_text(coalesce(w -> 'serverTime', '[]'::jsonb)) loop
      nd := nd || jsonb_build_object(k, t);
    end loop;
    segs := string_to_array(p, '/');
    insert into public.docs as d (path, parent, id, data) values (p, array_to_string(segs[1:array_length(segs, 1) - 1], '/'), segs[array_length(segs, 1)], nd)
      on conflict (path) do update set data = excluded.data, updated = now();
  end loop;
  -- kurallar: her değişen belge, işlemin SON haline göre denetlenir
  if not public.fs_is_admin() then
    for r in select f.path, f.data as old, d.data as new from pg_temp.fs_pre f left join public.docs d on d.path = f.path loop
      if r.old is null and r.new is null then continue; end if;
      if not coalesce(public.fs_can_write(r.path, r.old, r.new), false) then
        raise exception 'PERMISSION_DENIED' using detail = r.path;
      end if;
    end loop;
  end if;
  drop table pg_temp.fs_pre;
  return jsonb_build_object('ok', true, 'time', t);
end $$;

-- anlık sinyal (mesaj, arkadaşlık isteği, arama...): gönderen sunucuda eklenir, sahte gönderilemez
create or replace function public.fs_signal(target text, payload jsonb)
returns boolean
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare me text := public.fs_uid();
begin
  if me is null then raise exception 'PERMISSION_DENIED'; end if;
  if target !~ '^[A-Za-z0-9_-]{1,128}$' or jsonb_typeof(payload) <> 'object' or octet_length(payload::text) > 12000 then raise exception 'INVALID_ARGUMENT'; end if;
  perform realtime.send(payload || jsonb_build_object('from', me, 't', public.fs_now()), 'sig', 'sig:' || target, true);
  return true;
end $$;

-- Firebase'den taşıma (yalnız admin): docs = [{ path, data, updated? }, ...]
create or replace function public.fs_import(docs jsonb)
returns int
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare x jsonb; p text; segs text[]; n int := 0;
begin
  if not public.fs_is_admin() then raise exception 'PERMISSION_DENIED'; end if;
  for x in select * from jsonb_array_elements(docs) loop
    p := x ->> 'path';
    if not public.fs_path_ok(p) or jsonb_typeof(x -> 'data') <> 'object' then continue; end if;
    segs := string_to_array(p, '/');
    insert into public.docs as d (path, parent, id, data, updated)
      values (p, array_to_string(segs[1:array_length(segs, 1) - 1], '/'), segs[array_length(segs, 1)], x -> 'data',
              coalesce(to_timestamp(public.fs_n(x -> 'updated') / 1000), now()))
      on conflict (path) do update set data = excluded.data, updated = excluded.updated;
    n := n + 1;
  end loop;
  return n;
end $$;

-- veritabanı boyutu ve belge sayısı (admin panelinde gösterilir)
create or replace function public.fs_stats()
returns jsonb
language plpgsql volatile security definer set search_path = public, pg_temp as $$
begin
  if not public.fs_is_admin() then raise exception 'PERMISSION_DENIED'; end if;
  return jsonb_build_object('docs', (select count(*) from public.docs), 'bytes', pg_database_size(current_database()));
end $$;

-- oyun içi emote/sprey/kozmetik değişiklikleri "fx" kanalına anında gider (oyundaki mod launcher üzerinden okur)
create or replace function public.fs_fx_trigger() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'DELETE' then
    if old.parent in ('emotes', 'sprays', 'cosmetics') then
      perform realtime.send(jsonb_build_object('path', old.path, 'deleted', true), 'fx', 'fx', true);
    end if;
    return old;
  end if;
  if new.parent in ('emotes', 'sprays') then
    perform realtime.send(jsonb_build_object('path', new.path, 'data', new.data, 'ts', public.fs_now()), 'fx', 'fx', true);
  elsif new.parent = 'cosmetics' then
    perform realtime.send(jsonb_build_object('path', new.path, 'ts', public.fs_now()), 'fx', 'fx', true);
  end if;
  return new;
end $$;
drop trigger if exists docs_fx on public.docs;
create trigger docs_fx after insert or update or delete on public.docs for each row execute function public.fs_fx_trigger();

-- ---------------------------------------------------------------- yetkiler
do $$
declare fn text; r record;
begin
  -- yardımcı fonksiyonlar (fs_doc, fs_before ...) dışarıdan çağrılamaz
  for r in select p.oid::regprocedure as sig from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
           where ns.nspname = 'public' and p.proname like 'fs\_%' loop
    execute format('revoke all on function %s from public', r.sig);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on function %s from anon', r.sig); end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then execute format('revoke all on function %s from authenticated', r.sig); end if;
  end loop;
  foreach fn in array array[
    'fs_get(text[], text[])', 'fs_stamps(text[])', 'fs_query(text, jsonb, jsonb, integer, text, text[])', 'fs_commit(jsonb)', 'fs_signal(text, jsonb)',
    'fs_import(jsonb)', 'fs_stats()', 'fs_uid()', 'fs_now()'] loop
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('grant execute on function public.%s to anon', fn); end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then execute format('grant execute on function public.%s to authenticated', fn); end if;
  end loop;
end $$;

-- ---------------------------------------------------------------- Realtime kanal izinleri (özel kanallar)
--  presence : giriş yapmış herkes görür ve kendi durumunu yayınlar
--  sig:<uid>: sadece sahibi dinler; sinyaller yalnız fs_signal ile (sunucudan) gönderilir
--  fx       : giriş yapmış herkes dinler; yalnız veritabanı (tetikleyici) gönderir
do $$
begin
  if to_regclass('realtime.messages') is not null then
    execute 'alter table realtime.messages enable row level security';
    execute 'drop policy if exists cx_rt_read on realtime.messages';
    execute $p$create policy cx_rt_read on realtime.messages for select to anon, authenticated using (
      public.fs_uid() is not null and (realtime.topic() in ('presence', 'fx') or realtime.topic() = 'sig:' || public.fs_uid()))$p$;
    execute 'drop policy if exists cx_rt_presence on realtime.messages';
    execute $p$create policy cx_rt_presence on realtime.messages for insert to anon, authenticated with check (
      public.fs_uid() is not null and realtime.topic() = 'presence' and extension = 'presence')$p$;
  end if;
end $$;
