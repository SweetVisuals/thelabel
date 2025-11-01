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
