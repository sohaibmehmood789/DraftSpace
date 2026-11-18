begin;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 100),
  created_at timestamptz not null default now()
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default 'Untitled document'
    check (char_length(btrim(title)) between 1 and 200),
  content jsonb not null default '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb
    check (jsonb_typeof(content) = 'object' and content->>'type' is not distinct from 'doc'
      and jsonb_typeof(content->'content') is not distinct from 'array'
      and octet_length(content::text) <= 1048576),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.document_shares (
  document_id uuid not null references public.documents(id) on delete cascade,
  shared_with uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (document_id, shared_with)
);

create index documents_owner_updated_idx on public.documents(owner_id, updated_at desc);
create index document_shares_recipient_idx on public.document_shares(shared_with, document_id);

-- Auth users get a profile automatically. Email addresses stay in auth.users.
create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, display_name)
  values (new.id, left(coalesce(nullif(btrim(new.raw_user_meta_data->>'display_name'), ''),
    nullif(split_part(new.email, '@', 1), ''), 'User'), 100));
  return new;
end;
$$;
revoke all on function private.handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users
for each row execute function private.handle_new_user();

-- Also support accounts created before this migration.
insert into public.profiles(id, display_name)
select id, left(coalesce(nullif(btrim(raw_user_meta_data->>'display_name'), ''),
  nullif(split_part(email, '@', 1), ''), 'User'), 100)
from auth.users on conflict (id) do nothing;

create function private.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
revoke all on function private.set_updated_at() from public, anon, authenticated;
create trigger documents_updated_at before update on public.documents
for each row execute function private.set_updated_at();

-- Bypass RLS only for this ownership lookup to avoid recursive policies.
-- The caller cannot supply another user's ID.
create function private.is_document_owner(target_document_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.documents
    where id = target_document_id and owner_id = (select auth.uid()));
$$;
revoke all on function private.is_document_owner(uuid) from public, anon, authenticated;
grant execute on function private.is_document_owner(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.documents enable row level security;
alter table public.document_shares enable row level security;

-- Supabase projects can have permissive default grants; replace them explicitly.
revoke all on public.profiles, public.documents, public.document_shares from public, anon, authenticated;
grant select on public.profiles, public.documents, public.document_shares to authenticated;
grant update(display_name) on public.profiles to authenticated;
grant insert(id, owner_id, title, content) on public.documents to authenticated;
-- Ownership, IDs, and creation times cannot be changed by an editor or owner.
grant update(title, content) on public.documents to authenticated;
grant delete on public.documents, public.document_shares to authenticated;

create policy profiles_read_self on public.profiles for select to authenticated
using (id = (select auth.uid()));
create policy profiles_update_self on public.profiles for update to authenticated
using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy documents_read_accessible on public.documents for select to authenticated
using (owner_id = (select auth.uid()) or exists (
  select 1 from public.document_shares s where s.document_id = documents.id
  and s.shared_with = (select auth.uid())
));
create policy documents_create_owned on public.documents for insert to authenticated
with check (owner_id = (select auth.uid()));
create policy documents_edit_accessible on public.documents for update to authenticated
using (owner_id = (select auth.uid()) or exists (
  select 1 from public.document_shares s where s.document_id = documents.id
  and s.shared_with = (select auth.uid())
))
with check (owner_id = (select auth.uid()) or exists (
  select 1 from public.document_shares s where s.document_id = documents.id
  and s.shared_with = (select auth.uid())
));
create policy documents_delete_owned on public.documents for delete to authenticated
using (owner_id = (select auth.uid()));

create policy shares_read_accessible on public.document_shares for select to authenticated
using (shared_with = (select auth.uid()) or private.is_document_owner(document_id));
create policy shares_delete_owned on public.document_shares for delete to authenticated
using (private.is_document_owner(document_id));

-- Owner-only sharing by exact registered email, without exposing an email directory.
-- Direct INSERT grants are intentionally absent on document_shares.
create function public.share_document(target_document_id uuid, recipient_email text)
returns void language plpgsql security definer set search_path = '' as $$
declare recipient_id uuid;
begin
  if auth.uid() is null or not private.is_document_owner(target_document_id) then
    raise exception 'Only the document owner can share this document.' using errcode = '42501';
  end if;
  if recipient_email is null or char_length(btrim(recipient_email)) not between 3 and 254 then
    raise exception 'Enter a valid registered email address.' using errcode = '22023';
  end if;
  select id into recipient_id from auth.users
  where lower(email) = lower(btrim(recipient_email));
  if recipient_id is null then
    raise exception 'No registered user found with that email.' using errcode = '22023';
  end if;
  if recipient_id = auth.uid() then
    raise exception 'You already own this document.' using errcode = '22023';
  end if;
  insert into public.document_shares(document_id, shared_with)
  values (target_document_id, recipient_id) on conflict do nothing;
end;
$$;
revoke all on function public.share_document(uuid, text) from public, anon, authenticated;
grant execute on function public.share_document(uuid, text) to authenticated;

commit;
