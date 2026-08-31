# Implementation manifest

## Preserved source
- `src/pages/ReelsFeed.tsx` — supplied implementation copied unchanged from the uploaded project archive.
- `src/pages/ReelsUploadLegacy.tsx` — supplied upload implementation preserved intact as the URL-import workflow.

## Extended platform
- `src/pages/ReelsUpload.tsx` — new unified create flow; device upload, slideshow, prompt editor, recipe editor, draft/autosave and publish pipeline. URL Import delegates to the preserved implementation.
- `src/components/reels/*` — media player, recipe/comments/options sheet, upload bridge.
- `src/pages/{SearchPage,ProfilePage,NotificationsPage,SavedPage,DraftsPage,SettingsPage,Auth}.tsx` — production routes for the platform shell.
- `src/services/social.ts` — database-backed like/save/follow/copy helpers.
- `supabase/migrations/0001_prompt_reels.sql` — relational schema, constraints, triggers, RLS and storage policies.
- `server/index.ts` — server-side Gemini endpoint and configurable permitted extraction-provider proxy.

The archive intentionally does not fabricate a third-party media extraction provider. Existing extraction remains routed through `/api/tiktok/extract`; configure an authorized provider with `TIKTOK_EXTRACTOR_URL`.
