-- Close the last public bucket.
--
-- `profile-assets` is public. The other three were locked down earlier,
-- which is why every browser upload that called getPublicUrl afterwards
-- stored a link that 400s.
--
-- Nothing reads these buckets by public URL any more. Every read path runs
-- its response through signDbFileUrls, which swaps a stored URL for a
-- short-lived signed one, and the profile route now does the same. Every
-- write goes through /api/uploads, which issues a signed upload URL for a
-- path the server chose from the verified session. So the anon key needs
-- no access to storage at all.
--
-- RLS is already on for storage.objects in a Supabase project, and there
-- are no policies on it, which means a browser holding the anon key can
-- neither read nor write an object. That is the state we want, so this
-- migration adds no policies. A signed URL is the only way in.
--
-- Run this one LAST, after the application change is deployed. Flipping
-- the bucket before the new read paths are live would break avatars.
--
-- See docs/migrations-2026-11-04.md for the longer note.
--
-- Safe to run more than once.

do $mig$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'storage.buckets not present; skipping (this is expected outside Supabase).';
    return;
  end if;

  update storage.buckets set public = false where id = 'profile-assets';

  -- Size limits enforced by storage itself, not only by the upload route.
  -- A signed upload URL is good for one path; this is what stops a 2GB
  -- file going through one.
  update storage.buckets
     set file_size_limit = 15728640
   where id in ('documents', 'compliance-documents', 'message-attachments');

  update storage.buckets
     set file_size_limit = 5242880
   where id = 'profile-assets';
end
$mig$;
