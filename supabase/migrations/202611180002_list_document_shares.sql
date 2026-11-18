begin;

-- Only the owner can see the identities of people they have added. Keep profile
-- RLS and auth.users private; do not expose a general user/email directory.
create or replace function public.list_document_shares(target_document_id uuid)
returns table(shared_with uuid, display_name text, email text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.is_document_owner(target_document_id) then
    raise exception 'Only the document owner can view sharing details.' using errcode = '42501';
  end if;
  return query
    select s.shared_with, p.display_name, u.email::text
    from public.document_shares s
    join public.profiles p on p.id = s.shared_with
    join auth.users u on u.id = s.shared_with
    where s.document_id = target_document_id
    order by s.created_at, s.shared_with;
end;
$$;
revoke all on function public.list_document_shares(uuid) from public, anon, authenticated;
grant execute on function public.list_document_shares(uuid) to authenticated;

commit;
