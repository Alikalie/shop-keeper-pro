
-- Create storage bucket for profile avatars
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage bucket for demo videos
INSERT INTO storage.buckets (id, name, public) VALUES ('demo-videos', 'demo-videos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for avatars
CREATE POLICY "Anyone can view avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Authenticated users upload own avatar"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users update own avatar"
ON storage.objects FOR UPDATE
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own avatar"
ON storage.objects FOR DELETE
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies for demo videos (super admin only)
CREATE POLICY "Anyone can view demo videos"
ON storage.objects FOR SELECT
USING (bucket_id = 'demo-videos');

CREATE POLICY "Super admin uploads demo videos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'demo-videos' AND public.is_super_admin(auth.uid()));

CREATE POLICY "Super admin updates demo videos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'demo-videos' AND public.is_super_admin(auth.uid()));

CREATE POLICY "Super admin deletes demo videos"
ON storage.objects FOR DELETE
USING (bucket_id = 'demo-videos' AND public.is_super_admin(auth.uid()));
