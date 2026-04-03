-- Cadence: Extended Profile Fields Migration
-- Run this in Supabase SQL Editor after the initial schema

alter table user_profiles add column if not exists first_name text;
alter table user_profiles add column if not exists last_name text;
alter table user_profiles add column if not exists age int;
alter table user_profiles add column if not exists gender text check (gender in ('male','female','other','prefer_not_to_say'));
alter table user_profiles add column if not exists height_inches float;
alter table user_profiles add column if not exists weight_lbs float;
alter table user_profiles add column if not exists target_weight_lbs float;
alter table user_profiles add column if not exists priority_muscles text[];
alter table user_profiles add column if not exists training_time text check (training_time in ('morning','afternoon','evening','no_preference'));
alter table user_profiles add column if not exists additional_context text;
