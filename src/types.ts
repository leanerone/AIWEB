export interface AuthUser {
  id: number
  username: string
  display_name: string
  role: string
  department?: string
  domain?: string
  computer?: string
}

export interface Resource {
  id: number
  type: 'skill' | 'tool' | 'plugin'
  name: string
  summary: string
  content: string
  tags: string[]
  author: string
  source_type: string
  file_name: string | null
  external_url: string | null
  downloads: number
  views: number
  likes: number
  liked_by_me: boolean
  bookmarked_by_me?: boolean
  created_by: string
  created_at: string
  updated_at: string
}

export interface Memo {
  id: number
  title: string
  content: string
  tags: string[]
  pinned: boolean
  created_by: string
  bookmarked_by_me?: boolean
  created_at: string
  updated_at: string
}

export interface SearchHit {
  kind: 'resource' | 'memo' | 'rss'
  id: number
  title: string
  snippet: string
  created_by: string
  created_at: string
}

export interface NotificationItem {
  id: number
  ntype: 'comment' | 'like' | 'system'
  title: string
  content: string
  ref_type: string | null
  ref_id: number | null
  read: boolean
  created_at: string
}

export interface BookmarkItem {
  bookmark_id: number
  bookmarked_at: string
  target: Resource | Memo
}

export interface NoteLinkItem {
  id: number
  url: string
  title: string
  server: string
  database: string
  document: string
  created_at: string
}

export interface NotesParsed {
  valid: boolean
  url: string
  title: string
  server: string
  database: string
  view: string
  document: string
  replica_id: string
  view_id: string
  note_id: string
}

export interface ChatSessionItem {
  id: number
  title: string
  created_at: string
}

export interface ChatMsg {
  id?: number
  role: 'user' | 'assistant'
  content: string
  created_at?: string
}

export interface RssSourceItem {
  id: number
  name: string
  url: string
  enabled: boolean
  last_fetch_at: string | null
  last_error?: string
}

export interface RssItem {
  id: number
  title: string
  link: string
  summary: string
  source: string
  published_at: string
}

export interface FeedItem {
  kind: 'ai' | 'note' | 'announcement' | 'resource' | 'rss'
  id: number
  title: string
  summary: string
  content?: string
  source_url?: string
  ref_type?: string
  ref_id?: number
  created_by: string
  created_at: string
}

export interface Contributor {
  user: string
  count: number
  percent: number
}

export interface Stats {
  skills: number
  tools: number
  plugins: number
  memos: number
  chats: number
  rss_sources: number
  rss_items: number
  cards: number
}

export interface SettingsData {
  ai_api_base: string
  ai_api_key: string
  ai_model: string
  ai_system_prompt: string
  effective: { api_base: string; has_key: boolean; model: string }
}
