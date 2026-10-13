export type Profile = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
};

export type Message = {
  id: string;
  chat_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  seen_at: string | null;
};

export type ChatRow = {
  chat_id: string;
  other_id: string;
  other_username: string;
  other_display: string;
  other_avatar: string | null;
  last_body: string | null;
  last_sender: string | null;
  last_seen_at: string | null;
  last_message_at: string;
  unread: number;
};

export type GroupMessage = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
};
