export type TalkActor = {
  type: string;
  id: string;
  name?: string;
};

export type TalkObject = {
  type: string;
  id: string;
  name?: string;
  content?: string;
  mediaType?: string;
};

export type TalkTarget = {
  type: string;
  id: string;
  name?: string;
};

export type TalkEvent = {
  type: string;
  actor?: TalkActor;
  object?: TalkObject;
  target?: TalkTarget;
};

export type RenderedMessage = {
  raw: string;
  rendered: string;
};

export type RoomMapping = {
  roomToken: string;
  defaultConversationId: string;
  topics: Record<string, string>;
  updatedAt: string;
};

export type MappingFile = {
  rooms: Record<string, RoomMapping>;
};
