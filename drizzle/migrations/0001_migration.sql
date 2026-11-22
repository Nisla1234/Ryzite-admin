CREATE POLICY "Staff can view avatars"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'avatars' AND public.is_staff(auth.uid()));