-- =========================================
-- DATABASE SETUP FOR NEW SUPABASE PROJECT
-- Run this SQL in your Supabase Dashboard > SQL Editor
-- =========================================

-- 1. Create users table
-- Create a public users table for additional user data
create table public.users (
  id uuid not null primary key,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.users enable row level security;

-- Create policies
create policy "Users can view own profile"
  on public.users for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.users for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.users for insert
  with check (auth.uid() = id);

-- Create function to handle user creation
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, full_name, avatar_url)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$ language plpgsql security definer;

-- Create trigger to automatically create user profile
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. Create images, slideshows, and folders tables
-- Create storage bucket for images (only if it doesn't exist)
insert into storage.buckets (id, name, public)
values ('images', 'images', true)
on conflict (id) do nothing;

-- Create images table
create table public.images (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  filename text not null,
  file_path text not null,
  file_size integer not null,
  mime_type text not null,
  width integer,
  height integer,
  aspect_ratio numeric(4,2), -- e.g. 1.78 for 16:9, 0.56 for 9:16
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create slideshows table
create table public.slideshows (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  title text,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create folders table
create table public.folders (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  name text not null,
  parent_id uuid references public.folders(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create folder_images junction table
create table public.folder_images (
  id uuid default gen_random_uuid() primary key,
  folder_id uuid references public.folders(id) on delete cascade not null,
  image_id uuid references public.images(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(folder_id, image_id)
);

-- Create slideshow_images junction table
create table public.slideshow_images (
  id uuid default gen_random_uuid() primary key,
  slideshow_id uuid references public.slideshows(id) on delete cascade not null,
  image_id uuid references public.images(id) on delete cascade not null,
  position integer not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(slideshow_id, position)
);

-- Enable RLS
alter table public.images enable row level security;
alter table public.folders enable row level security;
alter table public.folder_images enable row level security;
alter table public.slideshows enable row level security;
alter table public.slideshow_images enable row level security;

-- Create policies for images
create policy "Users can view own images"
  on public.images for select
  using (auth.uid() = user_id);

create policy "Users can insert own images"
  on public.images for insert
  with check (auth.uid() = user_id);

create policy "Users can update own images"
  on public.images for update
  using (auth.uid() = user_id);

create policy "Users can delete own images"
  on public.images for delete
  using (auth.uid() = user_id);

-- Create policies for folders
create policy "Users can view own folders"
  on public.folders for select
  using (auth.uid() = user_id);

create policy "Users can insert own folders"
  on public.folders for insert
  with check (auth.uid() = user_id);

create policy "Users can update own folders"
  on public.folders for update
  using (auth.uid() = user_id);

create policy "Users can delete own folders"
  on public.folders for delete
  using (auth.uid() = user_id);

-- Create policies for folder_images
create policy "Users can view own folder images"
  on public.folder_images for select
  using (
    auth.uid() = (select user_id from public.folders where id = folder_id)
  );

create policy "Users can insert own folder images"
  on public.folder_images for insert
  with check (
    auth.uid() = (select user_id from public.folders where id = folder_id)
  );

create policy "Users can update own folder images"
  on public.folder_images for update
  using (
    auth.uid() = (select user_id from public.folders where id = folder_id)
  );

create policy "Users can delete own folder images"
  on public.folder_images for delete
  using (
    auth.uid() = (select user_id from public.folders where id = folder_id)
  );

-- Create policies for slideshows
create policy "Users can view own slideshows"
  on public.slideshows for select
  using (auth.uid() = user_id);

create policy "Users can insert own slideshows"
  on public.slideshows for insert
  with check (auth.uid() = user_id);

create policy "Users can update own slideshows"
  on public.slideshows for update
  using (auth.uid() = user_id);

create policy "Users can delete own slideshows"
  on public.slideshows for delete
  using (auth.uid() = user_id);

-- Create policies for slideshow_images
create policy "Users can view own slideshow images"
  on public.slideshow_images for select
  using (
    auth.uid() = (select user_id from public.slideshows where id = slideshow_id)
  );

create policy "Users can insert own slideshow images"
  on public.slideshow_images for insert
  with check (
    auth.uid() = (select user_id from public.slideshows where id = slideshow_id)
  );

create policy "Users can update own slideshow images"
  on public.slideshow_images for update
  using (
    auth.uid() = (select user_id from public.slideshows where id = slideshow_id)
  );

create policy "Users can delete own slideshow images"
  on public.slideshow_images for delete
  using (
    auth.uid() = (select user_id from public.slideshows where id = slideshow_id)
  );

-- Create storage policies
create policy "Users can view images in storage"
  on storage.objects for select
  using (bucket_id = 'images' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can upload images to storage"
  on storage.objects for insert
  with check (bucket_id = 'images' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can update own images in storage"
  on storage.objects for update
  using (bucket_id = 'images' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can delete own images in storage"
  on storage.objects for delete
  using (bucket_id = 'images' and auth.uid()::text = (storage.foldername(name))[1]);

-- Create indexes for better performance
create index images_user_id_idx on public.images(user_id);
create index images_created_at_idx on public.images(created_at desc);
create index folders_user_id_idx on public.folders(user_id);
create index folders_parent_id_idx on public.folders(parent_id);
create index folders_created_at_idx on public.folders(created_at desc);
create index folder_images_folder_id_idx on public.folder_images(folder_id);
create index folder_images_image_id_idx on public.folder_images(image_id);
create index slideshows_user_id_idx on public.slideshows(user_id);
create index slideshows_created_at_idx on public.slideshows(created_at desc);
create index slideshow_images_slideshow_id_idx on public.slideshow_images(slideshow_id);
create index slideshow_images_image_id_idx on public.slideshow_images(image_id);

-- 3. Add slideshow aspect ratio
alter table public.slideshows add column aspect_ratio text;

-- 4. Add images aspect ratio column (already added above)

-- 5. Create text templates table
create table public.text_templates (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  name text not null,
  text_content text not null,
  slide_index integer default 0,
  x numeric(6,2) default 50.00,
  y numeric(6,2) default 50.00,
  width numeric(6,2) default 60.00,
  height numeric(6,2) default 15.00,
  font_size numeric(5,2) default 24.00,
  color text default '#ffffff',
  font_family text default 'TikTok Sans',
  font_weight text default '400',
  alignment text default 'center',
  bold boolean default false,
  italic boolean default false,
  outline boolean default true,
  outline_color text default '#000000',
  outline_width numeric(4,2) default 1.90,
  outline_position text default 'outer',
  glow boolean default false,
  glow_color text default '#ffffff',
  glow_intensity numeric(5,2) default 5.00,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.text_templates enable row level security;

-- Create policies
create policy "Users can view own text templates"
  on public.text_templates for select
  using (auth.uid() = user_id);

create policy "Users can insert own text templates"
  on public.text_templates for insert
  with check (auth.uid() = user_id);

create policy "Users can update own text templates"
  on public.text_templates for update
  using (auth.uid() = user_id);

create policy "Users can delete own text templates"
  on public.text_templates for delete
  using (auth.uid() = user_id);

-- Create indexes
create index text_templates_user_id_idx on public.text_templates(user_id);
create index text_templates_created_at_idx on public.text_templates(created_at desc);

-- 6. Add Postiz API key to users
alter table public.users add column postiz_api_key text;

-- 7. Add slideshow metadata column
alter table public.slideshows add column metadata jsonb;

-- 8. Create slideshow templates table
create table public.slideshow_templates (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  name text not null,
  title text,
  post_title text,
  caption text,
  hashtags text[],
  text_overlays jsonb,
  transition_effect text default 'fade',
  music_enabled boolean default false,
  aspect_ratio text default '9:16',
  slide_count integer default 3,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.slideshow_templates enable row level security;

-- Create policies
create policy "Users can view own slideshow templates"
  on public.slideshow_templates for select
  using (auth.uid() = user_id);

create policy "Users can insert own slideshow templates"
  on public.slideshow_templates for insert
  with check (auth.uid() = user_id);

create policy "Users can update own slideshow templates"
  on public.slideshow_templates for update
  using (auth.uid() = user_id);

create policy "Users can delete own slideshow templates"
  on public.slideshow_templates for delete
  using (auth.uid() = user_id);

-- Create indexes
create index slideshow_templates_user_id_idx on public.slideshow_templates(user_id);
create index slideshow_templates_created_at_idx on public.slideshow_templates(created_at desc);

-- 9. Add rate limits table
create table public.rate_limits (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  platform text not null,
  rate_limit_hit_at timestamp with time zone default timezone('utc'::text, now()) not null,
  rate_limit_reset_at timestamp with time zone not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, platform)
);

-- Enable RLS
alter table public.rate_limits enable row level security;

-- Create policies
create policy "Users can view own rate limits"
  on public.rate_limits for select
  using (auth.uid() = user_id);

create policy "Users can insert own rate limits"
  on public.rate_limits for insert
  with check (auth.uid() = user_id);

create policy "Users can update own rate limits"
  on public.rate_limits for update
  using (auth.uid() = user_id);

create policy "Users can delete own rate limits"
  on public.rate_limits for delete
  using (auth.uid() = user_id);

-- Create indexes
create index rate_limits_user_id_idx on public.rate_limits(user_id);
create index rate_limits_platform_idx on public.rate_limits(platform);
create index rate_limits_reset_at_idx on public.rate_limits(rate_limit_reset_at);

-- Add hashtags table
create table public.hashtags (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  tag text not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, tag)
);

-- Enable RLS
alter table public.hashtags enable row level security;

-- Create policies
create policy "Users can view own hashtags"
  on public.hashtags for select
  using (auth.uid() = user_id);

create policy "Users can insert own hashtags"
  on public.hashtags for insert
  with check (auth.uid() = user_id);

create policy "Users can update own hashtags"
  on public.hashtags for update
  using (auth.uid() = user_id);

create policy "Users can delete own hashtags"
  on public.hashtags for delete
  using (auth.uid() = user_id);

-- Create indexes
create index hashtags_user_id_idx on public.hashtags(user_id);
create index hashtags_tag_idx on public.hashtags(tag);