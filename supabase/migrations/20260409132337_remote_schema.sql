drop extension if exists "pg_net";


  create table "public"."article_views" (
    "id" text not null,
    "article_id" text not null,
    "view_count" integer default 1,
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."article_views" enable row level security;


  create table "public"."articles" (
    "id" text not null,
    "title_en" text not null,
    "title_ro" text not null,
    "content_en" text not null,
    "content_ro" text not null,
    "category_id" text,
    "media_url" text,
    "author_id" text not null,
    "is_published" boolean default false,
    "created_at" timestamp with time zone default now(),
    "user_id" uuid,
    "type" text default 'text'::text,
    "location" text,
    "media_urls" text[],
    "poster_url" text
      );


alter table "public"."articles" enable row level security;


  create table "public"."categories" (
    "id" text not null,
    "name_en" text not null,
    "name_ro" text not null,
    "slug" text not null,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."categories" enable row level security;


  create table "public"."comments" (
    "id" text not null,
    "article_id" text,
    "user_id" uuid,
    "user_display_name" text,
    "content" text not null,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."comments" enable row level security;


  create table "public"."favorites" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid,
    "article_id" text,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."favorites" enable row level security;


  create table "public"."profiles" (
    "id" uuid not null,
    "display_name" text,
    "avatar_url" text,
    "email" text,
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."profiles" enable row level security;


  create table "public"."user_roles" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid,
    "role" text not null default 'reader'::text,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."user_roles" enable row level security;

CREATE UNIQUE INDEX article_views_article_id_unique ON public.article_views USING btree (article_id);

CREATE UNIQUE INDEX article_views_pkey ON public.article_views USING btree (id);

CREATE UNIQUE INDEX articles_pkey ON public.articles USING btree (id);

CREATE UNIQUE INDEX categories_pkey ON public.categories USING btree (id);

CREATE UNIQUE INDEX comments_pkey ON public.comments USING btree (id);

CREATE UNIQUE INDEX favorites_pkey ON public.favorites USING btree (id);

CREATE UNIQUE INDEX favorites_user_id_article_id_key ON public.favorites USING btree (user_id, article_id);

CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (id);

CREATE UNIQUE INDEX user_roles_pkey ON public.user_roles USING btree (id);

CREATE UNIQUE INDEX user_roles_user_id_key ON public.user_roles USING btree (user_id);

alter table "public"."article_views" add constraint "article_views_pkey" PRIMARY KEY using index "article_views_pkey";

alter table "public"."articles" add constraint "articles_pkey" PRIMARY KEY using index "articles_pkey";

alter table "public"."categories" add constraint "categories_pkey" PRIMARY KEY using index "categories_pkey";

alter table "public"."comments" add constraint "comments_pkey" PRIMARY KEY using index "comments_pkey";

alter table "public"."favorites" add constraint "favorites_pkey" PRIMARY KEY using index "favorites_pkey";

alter table "public"."profiles" add constraint "profiles_pkey" PRIMARY KEY using index "profiles_pkey";

alter table "public"."user_roles" add constraint "user_roles_pkey" PRIMARY KEY using index "user_roles_pkey";

alter table "public"."article_views" add constraint "article_views_article_id_fkey" FOREIGN KEY (article_id) REFERENCES public.articles(id) ON DELETE CASCADE not valid;

alter table "public"."article_views" validate constraint "article_views_article_id_fkey";

alter table "public"."article_views" add constraint "article_views_article_id_unique" UNIQUE using index "article_views_article_id_unique";

alter table "public"."articles" add constraint "articles_category_id_fkey" FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE CASCADE not valid;

alter table "public"."articles" validate constraint "articles_category_id_fkey";

alter table "public"."articles" add constraint "articles_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) not valid;

alter table "public"."articles" validate constraint "articles_user_id_fkey";

alter table "public"."comments" add constraint "comments_article_id_fkey" FOREIGN KEY (article_id) REFERENCES public.articles(id) ON DELETE CASCADE not valid;

alter table "public"."comments" validate constraint "comments_article_id_fkey";

alter table "public"."comments" add constraint "comments_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) not valid;

alter table "public"."comments" validate constraint "comments_user_id_fkey";

alter table "public"."favorites" add constraint "favorites_article_id_fkey" FOREIGN KEY (article_id) REFERENCES public.articles(id) ON DELETE CASCADE not valid;

alter table "public"."favorites" validate constraint "favorites_article_id_fkey";

alter table "public"."favorites" add constraint "favorites_user_id_article_id_key" UNIQUE using index "favorites_user_id_article_id_key";

alter table "public"."favorites" add constraint "favorites_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."favorites" validate constraint "favorites_user_id_fkey";

alter table "public"."profiles" add constraint "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."profiles" validate constraint "profiles_id_fkey";

alter table "public"."user_roles" add constraint "user_roles_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."user_roles" validate constraint "user_roles_user_id_fkey";

alter table "public"."user_roles" add constraint "user_roles_user_id_key" UNIQUE using index "user_roles_user_id_key";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.comment_count_last_minute(uid uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT COUNT(*)::integer
  FROM public.comments
  WHERE user_id = uid
    AND created_at > (now() - interval '1 minute');
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url, email)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', ''), 
    COALESCE(new.raw_user_meta_data->>'avatar_url', ''),
    new.email
  );
  
  -- Also create default role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'reader');
  
  RETURN new;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.increment_article_view(p_article_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.article_views (id, article_id, view_count, updated_at)
  VALUES (
    'view_' || p_article_id,
    p_article_id,
    1,
    now()
  )
  ON CONFLICT (article_id) DO UPDATE
    SET view_count = article_views.view_count + 1,
        updated_at = now();
END;
$function$
;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
;

grant delete on table "public"."article_views" to "anon";

grant insert on table "public"."article_views" to "anon";

grant references on table "public"."article_views" to "anon";

grant select on table "public"."article_views" to "anon";

grant trigger on table "public"."article_views" to "anon";

grant truncate on table "public"."article_views" to "anon";

grant update on table "public"."article_views" to "anon";

grant delete on table "public"."article_views" to "authenticated";

grant insert on table "public"."article_views" to "authenticated";

grant references on table "public"."article_views" to "authenticated";

grant select on table "public"."article_views" to "authenticated";

grant trigger on table "public"."article_views" to "authenticated";

grant truncate on table "public"."article_views" to "authenticated";

grant update on table "public"."article_views" to "authenticated";

grant delete on table "public"."article_views" to "service_role";

grant insert on table "public"."article_views" to "service_role";

grant references on table "public"."article_views" to "service_role";

grant select on table "public"."article_views" to "service_role";

grant trigger on table "public"."article_views" to "service_role";

grant truncate on table "public"."article_views" to "service_role";

grant update on table "public"."article_views" to "service_role";

grant delete on table "public"."articles" to "anon";

grant insert on table "public"."articles" to "anon";

grant references on table "public"."articles" to "anon";

grant select on table "public"."articles" to "anon";

grant trigger on table "public"."articles" to "anon";

grant truncate on table "public"."articles" to "anon";

grant update on table "public"."articles" to "anon";

grant delete on table "public"."articles" to "authenticated";

grant insert on table "public"."articles" to "authenticated";

grant references on table "public"."articles" to "authenticated";

grant select on table "public"."articles" to "authenticated";

grant trigger on table "public"."articles" to "authenticated";

grant truncate on table "public"."articles" to "authenticated";

grant update on table "public"."articles" to "authenticated";

grant delete on table "public"."articles" to "service_role";

grant insert on table "public"."articles" to "service_role";

grant references on table "public"."articles" to "service_role";

grant select on table "public"."articles" to "service_role";

grant trigger on table "public"."articles" to "service_role";

grant truncate on table "public"."articles" to "service_role";

grant update on table "public"."articles" to "service_role";

grant delete on table "public"."categories" to "anon";

grant insert on table "public"."categories" to "anon";

grant references on table "public"."categories" to "anon";

grant select on table "public"."categories" to "anon";

grant trigger on table "public"."categories" to "anon";

grant truncate on table "public"."categories" to "anon";

grant update on table "public"."categories" to "anon";

grant delete on table "public"."categories" to "authenticated";

grant insert on table "public"."categories" to "authenticated";

grant references on table "public"."categories" to "authenticated";

grant select on table "public"."categories" to "authenticated";

grant trigger on table "public"."categories" to "authenticated";

grant truncate on table "public"."categories" to "authenticated";

grant update on table "public"."categories" to "authenticated";

grant delete on table "public"."categories" to "service_role";

grant insert on table "public"."categories" to "service_role";

grant references on table "public"."categories" to "service_role";

grant select on table "public"."categories" to "service_role";

grant trigger on table "public"."categories" to "service_role";

grant truncate on table "public"."categories" to "service_role";

grant update on table "public"."categories" to "service_role";

grant delete on table "public"."comments" to "anon";

grant insert on table "public"."comments" to "anon";

grant references on table "public"."comments" to "anon";

grant select on table "public"."comments" to "anon";

grant trigger on table "public"."comments" to "anon";

grant truncate on table "public"."comments" to "anon";

grant update on table "public"."comments" to "anon";

grant delete on table "public"."comments" to "authenticated";

grant insert on table "public"."comments" to "authenticated";

grant references on table "public"."comments" to "authenticated";

grant select on table "public"."comments" to "authenticated";

grant trigger on table "public"."comments" to "authenticated";

grant truncate on table "public"."comments" to "authenticated";

grant update on table "public"."comments" to "authenticated";

grant delete on table "public"."comments" to "service_role";

grant insert on table "public"."comments" to "service_role";

grant references on table "public"."comments" to "service_role";

grant select on table "public"."comments" to "service_role";

grant trigger on table "public"."comments" to "service_role";

grant truncate on table "public"."comments" to "service_role";

grant update on table "public"."comments" to "service_role";

grant delete on table "public"."favorites" to "anon";

grant insert on table "public"."favorites" to "anon";

grant references on table "public"."favorites" to "anon";

grant select on table "public"."favorites" to "anon";

grant trigger on table "public"."favorites" to "anon";

grant truncate on table "public"."favorites" to "anon";

grant update on table "public"."favorites" to "anon";

grant delete on table "public"."favorites" to "authenticated";

grant insert on table "public"."favorites" to "authenticated";

grant references on table "public"."favorites" to "authenticated";

grant select on table "public"."favorites" to "authenticated";

grant trigger on table "public"."favorites" to "authenticated";

grant truncate on table "public"."favorites" to "authenticated";

grant update on table "public"."favorites" to "authenticated";

grant delete on table "public"."favorites" to "service_role";

grant insert on table "public"."favorites" to "service_role";

grant references on table "public"."favorites" to "service_role";

grant select on table "public"."favorites" to "service_role";

grant trigger on table "public"."favorites" to "service_role";

grant truncate on table "public"."favorites" to "service_role";

grant update on table "public"."favorites" to "service_role";

grant delete on table "public"."profiles" to "anon";

grant insert on table "public"."profiles" to "anon";

grant references on table "public"."profiles" to "anon";

grant select on table "public"."profiles" to "anon";

grant trigger on table "public"."profiles" to "anon";

grant truncate on table "public"."profiles" to "anon";

grant update on table "public"."profiles" to "anon";

grant delete on table "public"."profiles" to "authenticated";

grant insert on table "public"."profiles" to "authenticated";

grant references on table "public"."profiles" to "authenticated";

grant select on table "public"."profiles" to "authenticated";

grant trigger on table "public"."profiles" to "authenticated";

grant truncate on table "public"."profiles" to "authenticated";

grant update on table "public"."profiles" to "authenticated";

grant delete on table "public"."profiles" to "service_role";

grant insert on table "public"."profiles" to "service_role";

grant references on table "public"."profiles" to "service_role";

grant select on table "public"."profiles" to "service_role";

grant trigger on table "public"."profiles" to "service_role";

grant truncate on table "public"."profiles" to "service_role";

grant update on table "public"."profiles" to "service_role";

grant delete on table "public"."user_roles" to "anon";

grant insert on table "public"."user_roles" to "anon";

grant references on table "public"."user_roles" to "anon";

grant select on table "public"."user_roles" to "anon";

grant trigger on table "public"."user_roles" to "anon";

grant truncate on table "public"."user_roles" to "anon";

grant update on table "public"."user_roles" to "anon";

grant delete on table "public"."user_roles" to "authenticated";

grant insert on table "public"."user_roles" to "authenticated";

grant references on table "public"."user_roles" to "authenticated";

grant select on table "public"."user_roles" to "authenticated";

grant trigger on table "public"."user_roles" to "authenticated";

grant truncate on table "public"."user_roles" to "authenticated";

grant update on table "public"."user_roles" to "authenticated";

grant delete on table "public"."user_roles" to "service_role";

grant insert on table "public"."user_roles" to "service_role";

grant references on table "public"."user_roles" to "service_role";

grant select on table "public"."user_roles" to "service_role";

grant trigger on table "public"."user_roles" to "service_role";

grant truncate on table "public"."user_roles" to "service_role";

grant update on table "public"."user_roles" to "service_role";


  create policy "Anyone can read article view counts"
  on "public"."article_views"
  as permissive
  for select
  to public
using (true);



  create policy "Article views are viewable by everyone"
  on "public"."article_views"
  as permissive
  for select
  to public
using (true);



  create policy "Admins can manage all articles"
  on "public"."articles"
  as permissive
  for all
  to public
using ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::text)))))
with check ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::text)))));



  create policy "Published articles are viewable by everyone"
  on "public"."articles"
  as permissive
  for select
  to public
using ((is_published = true));



  create policy "Users can delete their own articles"
  on "public"."articles"
  as permissive
  for delete
  to public
using ((auth.uid() = user_id));



  create policy "Users can insert their own articles"
  on "public"."articles"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "Users can update their own articles"
  on "public"."articles"
  as permissive
  for update
  to public
using ((auth.uid() = user_id));



  create policy "Users can view their own unpublished articles"
  on "public"."articles"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "Writers can update own draft articles"
  on "public"."articles"
  as permissive
  for update
  to authenticated
using ((user_id = auth.uid()))
with check (((user_id = auth.uid()) AND ((is_published = false) OR (EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::text)))))));



  create policy "Admins can manage categories"
  on "public"."categories"
  as permissive
  for all
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::text)))))
with check ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::text)))));



  create policy "Public categories are viewable by everyone"
  on "public"."categories"
  as permissive
  for select
  to public
using (true);



  create policy "Anyone can read comments"
  on "public"."comments"
  as permissive
  for select
  to public
using (true);



  create policy "Authenticated users can insert with rate limit"
  on "public"."comments"
  as permissive
  for insert
  to public
with check (((auth.uid() IS NOT NULL) AND (user_id = auth.uid()) AND (public.comment_count_last_minute(auth.uid()) < 5)));



  create policy "Authenticated users can post comments"
  on "public"."comments"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "Comments are viewable by everyone"
  on "public"."comments"
  as permissive
  for select
  to public
using (true);



  create policy "Users can delete own comments"
  on "public"."comments"
  as permissive
  for delete
  to public
using ((auth.uid() = user_id));



  create policy "Users can delete their own comments"
  on "public"."comments"
  as permissive
  for delete
  to public
using ((auth.uid() = user_id));



  create policy "Users can update own comments"
  on "public"."comments"
  as permissive
  for update
  to public
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));



  create policy "Users can manage their own favorites"
  on "public"."favorites"
  as permissive
  for all
  to public
using ((auth.uid() = user_id));



  create policy "Users can view their own favorites"
  on "public"."favorites"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "Public profiles are viewable by everyone"
  on "public"."profiles"
  as permissive
  for select
  to public
using (true);



  create policy "Users can update their own profile"
  on "public"."profiles"
  as permissive
  for update
  to public
using ((auth.uid() = id));



  create policy "Users can view their own role"
  on "public"."user_roles"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));


CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


  create policy "Authenticated users can upload to articles"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check (((bucket_id = 'articles'::text) AND (auth.role() = 'authenticated'::text)));



  create policy "Public Access"
  on "storage"."objects"
  as permissive
  for select
  to public
using (((bucket_id = 'articles'::text) OR (bucket_id = 'avatars'::text)));



  create policy "Users can upload their own avatar"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));



  create policy "Users can upload to own folder in articles bucket"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'articles'::text) AND (((storage.foldername(name))[1] = (auth.uid())::text) OR (((storage.foldername(name))[1] = 'articles'::text) AND ((storage.foldername(name))[2] = (auth.uid())::text)) OR (((storage.foldername(name))[1] = 'carousels'::text) AND ((storage.foldername(name))[2] = (auth.uid())::text)) OR (((storage.foldername(name))[1] = 'stories'::text) AND ((storage.foldername(name))[3] = (auth.uid())::text)))));



