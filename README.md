# PromptReels — prompt-centric Shorts platform

This workspace preserves the supplied `ReelsFeed.tsx` implementation and its existing URL-import/Gemini upload implementation (`ReelsUploadLegacy.tsx`), then adds a production-oriented platform shell around them.

## Included
- Existing Supabase reels feed, category/search filters, realtime refresh, swipe/wheel/keyboard navigation.
- Existing URL import, duplicate detection, metadata extraction and Gemini assistant flow preserved.
- Device upload for video/images, slideshow previews, Supabase Storage publishing.
- Prompt recipe editor, draft persistence + local recovery, profile/search/saved/notifications routes.
- Comment/recipe/options sheet, prompt copying and share flow.
- Supabase migration with relational tables, indexes, triggers and RLS.
- Server-side Gemini endpoint; no secret key is placed in browser code.

## Setup
1. Copy `.env.example` to `.env` and set Supabase URL + anon key.
2. Apply `supabase/migrations/0001_prompt_reels.sql` in Supabase SQL Editor.
3. Create public Storage buckets named `reels` and `profiles` (or adapt policies/bucket names).
4. For Gemini, set `GEMINI_API_KEY` only in the server environment.
5. If URL extraction is already provided by your existing backend, point `TIKTOK_EXTRACTOR_URL` at that permitted endpoint. The original upload page remains intact and uses `/api/tiktok/extract`.
6. `npm install && npm run dev:full`.

## Notes
The frontend never uses a Supabase service-role key. RLS is the security boundary for user-owned data. Third-party media should only be imported/processed where you have the necessary rights and the configured extractor supports it.
