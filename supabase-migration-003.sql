-- Migration 003: AI coaching layer tables

create table ai_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  session_id uuid references sessions on delete cascade,
  type text check (type in (
    'post_workout',
    'pre_workout',
    'weekly_debrief',
    'pattern_detection',
    'milestone',
    'plateau',
    'deload_warning',
    'goal_drift'
  )),
  content text not null,
  metadata jsonb,
  read boolean default false,
  dismissed boolean default false,
  created_at timestamptz default now()
);

create table training_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  session_id uuid references sessions on delete cascade,
  note text,
  parsed_context jsonb,
  created_at timestamptz default now()
);

create table milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  type text,
  exercise_name text,
  value float,
  previous_value float,
  achieved_at timestamptz default now(),
  celebrated boolean default false
);

-- RLS for ai_insights
alter table ai_insights enable row level security;
create policy "Users manage own insights" on ai_insights
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- RLS for training_notes
alter table training_notes enable row level security;
create policy "Users manage own training notes" on training_notes
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- RLS for milestones
alter table milestones enable row level security;
create policy "Users manage own milestones" on milestones
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
