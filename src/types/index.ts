export type MemberRole = 'admin' | 'director' | 'member';

export interface Profile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  instrument: string | null;
  push_token?: string | null;
  notify_new_song?: boolean;
  notify_live_session?: boolean;
  notify_comment?: boolean;
  created_at: string;
}

export interface Community {
  id: string;
  name: string;
  description: string | null;
  cover_url: string | null;
  owner_id: string | null;
  invite_code: string;
  max_members: number;
  created_at: string;
}

export interface CommunityMember {
  community_id: string;
  profile_id: string;
  role: MemberRole;
  joined_at: string;
  profile?: Profile;
}

export interface Song {
  id: string;
  community_id: string;
  title: string;
  artist: string | null;
  original_key: string;
  bpm: number | null;
  lyrics_chordpro: string | null;
  youtube_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Setlist {
  id: string;
  community_id: string;
  title: string;
  event_date: string | null;
  created_by: string | null;
  created_at: string;
}

export interface SetlistSong {
  id: string;
  setlist_id: string;
  song_id: string;
  position: number;
  transposed_key: string | null;
  notes: string | null;
  song?: Song;
}

export interface LiveSession {
  community_id: string;
  is_active: boolean;
  setlist_id: string | null;
  current_setlist_song_id: string | null;
  current_song_id: string | null;
  current_key: string | null;
  started_by: string | null;
  updated_at: string;
}

export interface Comment {
  id: string;
  song_id: string;
  profile_id: string;
  body: string;
  created_at: string;
  profile?: Profile;
}
