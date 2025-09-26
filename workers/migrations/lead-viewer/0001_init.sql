--
-- Lead viewer access logging table
-- --------------------------------
--
-- Every query to the read-only lead viewer Worker is appended here so the
-- compliance team can reconcile who inspected sensitive submissions. Keeping
-- the table in its own D1 database avoids granting write permissions to the
-- intake databases powering the public forms.
--
create table if not exists lead_viewer_access_log (
  id text primary key,
  actor text not null,
  ip_address text,
  user_agent text,
  search_term text,
  page integer not null,
  per_page integer not null,
  requested_datasets text not null,
  created_at text not null default (datetime('now'))
);

create index if not exists idx_lead_viewer_access_created_at on lead_viewer_access_log(created_at);
create index if not exists idx_lead_viewer_access_actor on lead_viewer_access_log(actor);
