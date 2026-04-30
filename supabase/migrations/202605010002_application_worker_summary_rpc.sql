create or replace function get_application_worker_summary(worker_ids uuid[])
returns table (
  id          uuid,
  full_name   text,
  trust_tier  text
)
language sql
security definer
set search_path = public
as $$
  select
    p.id,
    p.full_name,
    wp.trust_tier::text
  from profiles p
  left join worker_profiles wp on wp.profile_id = p.id
  where p.id = any(worker_ids)
    and exists (
      select 1
      from job_applications ja
      join jobs j on j.id = ja.job_id
      where ja.worker_id = p.id
        and j.client_id  = auth.uid()
        and ja.status   != 'rejected'
    );
$$;

revoke all on function get_application_worker_summary(uuid[]) from public;
grant execute on function get_application_worker_summary(uuid[]) to authenticated;
