-- TrainLocal Supabase Schema
-- Run this in the Supabase SQL editor

-- ═══════════════════════════════════════
-- TABLES
-- ═══════════════════════════════════════

create table if not exists user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade unique,
  goal text check (goal in ('fat_loss','muscle_gain','strength','endurance','general')),
  experience text check (experience in ('beginner','intermediate','advanced')),
  days_per_week int,
  equipment text check (equipment in ('full_gym','home_gym','dumbbells','bodyweight')),
  limitations text[],
  squat_1rm float,
  bench_1rm float,
  deadlift_1rm float,
  updated_at timestamptz default now()
);

create table if not exists exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  name text not null,
  muscle_group text,
  movement_type text,
  is_global boolean default false
);

create table if not exists programs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  name text not null,
  description text,
  category text,
  weeks int,
  days_per_week int,
  ai_generated boolean default false,
  created_at timestamptz default now()
);

create table if not exists workout_days (
  id uuid primary key default gen_random_uuid(),
  program_id uuid references programs on delete cascade,
  name text not null,
  order_index int
);

create table if not exists workout_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_day_id uuid references workout_days on delete cascade,
  exercise_id uuid references exercises,
  order_index int,
  target_sets int,
  target_reps int,
  target_weight float,
  notes text
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  workout_day_id uuid references workout_days,
  program_id uuid references programs,
  started_at timestamptz default now(),
  finished_at timestamptz,
  duration_seconds int,
  feedback_rating int check (feedback_rating between 1 and 5),
  notes text
);

create table if not exists session_sets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions on delete cascade,
  exercise_id uuid references exercises,
  set_number int,
  reps int,
  weight float,
  completed boolean default false,
  rpe float
);

create table if not exists adaptations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  program_id uuid references programs,
  week_number int,
  suggestion text,
  accepted boolean,
  created_at timestamptz default now()
);

-- ═══════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════

alter table user_profiles enable row level security;
alter table exercises enable row level security;
alter table programs enable row level security;
alter table workout_days enable row level security;
alter table workout_exercises enable row level security;
alter table sessions enable row level security;
alter table session_sets enable row level security;
alter table adaptations enable row level security;

-- user_profiles: users can manage their own profile
create policy "Users manage own profile" on user_profiles
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- exercises: users see global + their own
create policy "Users see global and own exercises" on exercises
  for select using (is_global = true or auth.uid() = user_id);
create policy "Users manage own exercises" on exercises
  for insert with check (auth.uid() = user_id);
create policy "Users update own exercises" on exercises
  for update using (auth.uid() = user_id);
create policy "Users delete own exercises" on exercises
  for delete using (auth.uid() = user_id);

-- programs: users manage their own
create policy "Users manage own programs" on programs
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- workout_days: access via program ownership
create policy "Users access own workout days" on workout_days
  for all using (
    exists (select 1 from programs where programs.id = workout_days.program_id and programs.user_id = auth.uid())
  );

-- workout_exercises: access via workout day -> program ownership
create policy "Users access own workout exercises" on workout_exercises
  for all using (
    exists (
      select 1 from workout_days
      join programs on programs.id = workout_days.program_id
      where workout_days.id = workout_exercises.workout_day_id
      and programs.user_id = auth.uid()
    )
  );

-- sessions: users manage their own
create policy "Users manage own sessions" on sessions
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- session_sets: access via session ownership
create policy "Users access own session sets" on session_sets
  for all using (
    exists (select 1 from sessions where sessions.id = session_sets.session_id and sessions.user_id = auth.uid())
  );

-- adaptations: users manage their own
create policy "Users manage own adaptations" on adaptations
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ═══════════════════════════════════════
-- SEED EXERCISES (Global)
-- ═══════════════════════════════════════

insert into exercises (name, muscle_group, movement_type, is_global, user_id) values
  -- Compound Barbell
  ('Barbell Back Squat', 'Legs', 'compound', true, null),
  ('Barbell Front Squat', 'Legs', 'compound', true, null),
  ('Barbell Bench Press', 'Chest', 'compound', true, null),
  ('Incline Barbell Bench Press', 'Chest', 'compound', true, null),
  ('Barbell Deadlift', 'Back', 'compound', true, null),
  ('Barbell Overhead Press', 'Shoulders', 'compound', true, null),
  ('Barbell Row', 'Back', 'compound', true, null),
  ('Romanian Deadlift', 'Legs', 'compound', true, null),
  ('Sumo Deadlift', 'Legs', 'compound', true, null),
  ('Barbell Hip Thrust', 'Legs', 'compound', true, null),
  -- Machine / Cable
  ('Leg Press', 'Legs', 'compound', true, null),
  ('Hack Squat', 'Legs', 'compound', true, null),
  ('Leg Extension', 'Legs', 'isolation', true, null),
  ('Leg Curl', 'Legs', 'isolation', true, null),
  ('Lat Pulldown', 'Back', 'compound', true, null),
  ('Cable Row', 'Back', 'compound', true, null),
  ('Chest Supported Row', 'Back', 'compound', true, null),
  ('Cable Fly', 'Chest', 'isolation', true, null),
  ('Face Pull', 'Shoulders', 'isolation', true, null),
  ('Tricep Pushdown', 'Arms', 'isolation', true, null),
  ('Cable Curl', 'Arms', 'isolation', true, null),
  -- Dumbbell
  ('Dumbbell Bench Press', 'Chest', 'compound', true, null),
  ('Incline Dumbbell Press', 'Chest', 'compound', true, null),
  ('Dumbbell Shoulder Press', 'Shoulders', 'compound', true, null),
  ('Dumbbell Curl', 'Arms', 'isolation', true, null),
  ('Dumbbell Lateral Raise', 'Shoulders', 'isolation', true, null),
  ('Dumbbell Row', 'Back', 'compound', true, null),
  ('Dumbbell Lunge', 'Legs', 'compound', true, null),
  ('Dumbbell Romanian Deadlift', 'Legs', 'compound', true, null),
  ('Skull Crusher', 'Arms', 'isolation', true, null),
  ('Preacher Curl', 'Arms', 'isolation', true, null),
  ('Hammer Curl', 'Arms', 'isolation', true, null),
  ('Dumbbell Fly', 'Chest', 'isolation', true, null),
  -- Bodyweight
  ('Pull-Up', 'Back', 'compound', true, null),
  ('Chin-Up', 'Back', 'compound', true, null),
  ('Dip', 'Chest', 'compound', true, null),
  ('Push-Up', 'Chest', 'compound', true, null),
  ('Bulgarian Split Squat', 'Legs', 'compound', true, null),
  ('Step Up', 'Legs', 'compound', true, null),
  ('Plank', 'Core', 'isolation', true, null),
  ('Hanging Leg Raise', 'Core', 'isolation', true, null),
  ('Mountain Climbers', 'Core', 'compound', true, null),
  -- Functional
  ('Farmers Carry', 'Full Body', 'compound', true, null),
  ('Kettlebell Swing', 'Full Body', 'compound', true, null),
  ('Box Jump', 'Legs', 'compound', true, null);
