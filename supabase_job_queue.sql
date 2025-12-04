-- Create the job_queue table
create table if not exists job_queue (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null,
  account_id text, -- The Postiz profile ID this job is for
  status text not null check (status in ('pending', 'processing', 'completed', 'failed')),
  scheduled_start_time timestamp with time zone not null,
  batch_index integer default 1, -- Which batch number this is (e.g., 1)
  total_batches integer default 1, -- Total batches in the original request (e.g., 5)
  payload jsonb not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  error text
);

-- Enable Row Level Security
alter table job_queue enable row level security;

-- Create policies
create policy "Users can view their own jobs"
  on job_queue for select
  using (auth.uid() = user_id);

create policy "Users can insert their own jobs"
  on job_queue for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own jobs"
  on job_queue for update
  using (auth.uid() = user_id);

create policy "Users can delete their own jobs"
  on job_queue for delete
  using (auth.uid() = user_id);
