import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Bell,
  Loader2,
  MessageCircle,
  Search,
  Send,
} from "lucide-react";

import { authClient } from "@/lib/auth-client";
import { formatPostDate } from "@/lib/format-date";
import { resolveMediaUrl } from "@/lib/media-url";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PresenceStatusIndicator } from "@/components/presence-status";
import { usePresence } from "@/hooks/usePresence";
import { queryClient, trpc } from "@/utils/trpc";
import { cn } from "@/lib/utils";

type MessagesSearch = {
  userId?: string;
};

export const Route = createFileRoute("/messages")({
  component: MessagesPage,
  validateSearch: (search: Record<string, unknown>): MessagesSearch => ({
    userId: typeof search.userId === "string" ? search.userId : undefined,
  }),
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data) {
      throw redirect({ to: "/" });
    }
    return { session };
  },
});

function MessagesPage() {
  const { session } = Route.useRouteContext();
  const search = Route.useSearch();
  const myId = session.data?.user?.id;

  const [selectedUserId, setSelectedUserId] = useState<string | null>(
    search.userId ?? null,
  );
  const [inputValue, setInputValue] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const conversationsOptions = trpc.chat.listConversations.queryOptions();
  const { data: conversationsData, isLoading: convsLoading } = useQuery({
    ...conversationsOptions,
  });

  const messagesOptions = trpc.chat.getMessages.queryOptions({
    otherUserId: selectedUserId ?? "",
    limit: 80,
  });
  const { data: messagesData, isLoading: msgsLoading } = useQuery({
    ...messagesOptions,
    enabled: !!selectedUserId,
  });

  const pingUser = useMutation(
    trpc.chat.pingUser.mutationOptions({
      onError: (err: { message?: string }) => {
        toast.error(err.message ?? "Failed to ping");
      },
    }),
  );

  const sendMessage = useMutation(
    trpc.chat.sendMessage.mutationOptions({
      onSuccess: (newMessage: Record<string, unknown>, variables: { receiverId: string }) => {
        setInputValue("");
        const messagesQueryKey = trpc.chat.getMessages.queryOptions({
          otherUserId: variables.receiverId,
          limit: 80,
        }).queryKey;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        queryClient.setQueryData(messagesQueryKey, (prev: any) => {
          if (!prev?.messages) return prev;
          return { ...prev, messages: [...prev.messages, newMessage] };
        });
        queryClient.invalidateQueries({
          queryKey: trpc.chat.listConversations.queryOptions().queryKey,
        });
        queryClient.invalidateQueries({
          queryKey: trpc.chat.getUnreadCount.queryOptions().queryKey,
        });
      },
      onError: (err: { message?: string }) => {
        toast.error(err.message ?? "Failed to send message");
      },
    }),
  );

  const allConversations = conversationsData?.conversations ?? [];
  const searchLower = searchQuery.trim().toLowerCase();
  const conversations = searchLower
    ? allConversations.filter(
        (c) =>
          (c.user.name ?? "").toLowerCase().includes(searchLower) ||
          (c.user.email ?? "").toLowerCase().includes(searchLower),
      )
    : allConversations;

  const presenceUserIds = [
    ...allConversations.map((c) => c.user.id),
    ...(selectedUserId ? [selectedUserId] : []),
  ].filter((id, i, arr) => arr.indexOf(id) === i);
  const { statuses: presenceStatuses } = usePresence(presenceUserIds);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messagesData?.messages?.length]);

  useEffect(() => {
    if (selectedUserId && messagesData != null) {
      queryClient.invalidateQueries({
        queryKey: trpc.chat.getUnreadCount.queryOptions().queryKey,
      });
      queryClient.invalidateQueries({
        queryKey: trpc.chat.listConversations.queryOptions().queryKey,
      });
    }
  }, [selectedUserId, messagesData != null]);

  useEffect(() => {
    if (selectedUserId) {
      inputRef.current?.focus();
    }
  }, [selectedUserId]);

  const handleSend = () => {
    const content = inputValue.trim();
    if (!content || !selectedUserId) return;
    sendMessage.mutate({ receiverId: selectedUserId, content });
  };

  const messages = (messagesData?.messages ?? []) as Array<{
    id: string;
    senderId: string;
    receiverId: string;
    content: string;
    createdAt: string | Date;
    sender: { id: string; name: string; image: string | null };
    receiver: { id: string; name: string; image: string | null };
  }>;
  const otherUser = messagesData?.otherUser as
    | { id: string; name: string; image: string | null }
    | undefined;

  const selectedConv = allConversations.find(
    (c) => c.user.id === selectedUserId,
  );

  return (
    <div className="mx-auto flex h-full w-full max-w-6xl flex-col px-3 py-3 sm:px-4 sm:py-4">
      <div className="flex min-h-0 flex-1 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
        {/* Contact list — always visible on md+, conditionally on mobile */}
        <div
          className={cn(
            "flex w-full flex-col border-r border-border/40 md:w-80 lg:w-96",
            selectedUserId ? "hidden md:flex" : "flex",
          )}
        >
          <div className="space-y-2 border-b border-border/40 p-4">
            <h2 className="text-lg font-semibold tracking-tight">Messages</h2>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 rounded-lg bg-muted/50 pl-8 text-sm"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {convsLoading ? (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                <Loader2 className="mr-2 size-4 animate-spin" />
                Loading...
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center text-sm text-muted-foreground">
                <MessageCircle className="size-10 opacity-40" />
                {searchLower ? (
                  <p>No results for &quot;{searchQuery.trim()}&quot;</p>
                ) : (
                  <p>No conversations yet</p>
                )}
              </div>
            ) : (
              <ul>
                {conversations.map(
                  ({ user, lastMessage, unreadCount: convUnread }) => (
                    <li key={user.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedUserId(user.id)}
                        className={cn(
                          "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
                          selectedUserId === user.id
                            ? "bg-muted"
                            : "hover:bg-muted/50",
                        )}
                      >
                        <div className="relative shrink-0">
                          {user.image ? (
                            <img
                              src={resolveMediaUrl(user.image)}
                              alt=""
                              className="size-11 rounded-full object-cover"
                            />
                          ) : (
                            <div className="flex size-11 items-center justify-center rounded-full bg-primary/20 text-sm font-medium text-primary">
                              {user.name?.charAt(0) ?? "?"}
                            </div>
                          )}
                          <span className="absolute bottom-0 right-0">
                            <PresenceStatusIndicator
                              status={presenceStatuses[user.id] ?? "offline"}
                              size="sm"
                            />
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p
                              className={cn(
                                "truncate text-sm",
                                convUnread > 0
                                  ? "font-semibold"
                                  : "font-medium",
                              )}
                            >
                              {user.name}
                            </p>
                            {lastMessage && (
                              <span className="shrink-0 text-[10px] text-muted-foreground">
                                {formatPostDate(lastMessage.createdAt)}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            {lastMessage ? (
                              <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                                {lastMessage.fromMe ? "You: " : ""}
                                {lastMessage.content}
                              </p>
                            ) : (
                              <p className="text-xs text-muted-foreground">
                                No messages yet
                              </p>
                            )}
                            {convUnread > 0 && (
                              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                                {convUnread > 99 ? "99+" : convUnread}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    </li>
                  ),
                )}
              </ul>
            )}
          </div>
        </div>

        {/* Chat panel */}
        <div
          className={cn(
            "flex min-w-0 flex-1 flex-col",
            !selectedUserId ? "hidden md:flex" : "flex",
          )}
        >
          {selectedUserId ? (
            <>
              {/* Chat header */}
              <div className="flex items-center gap-3 border-b border-border/40 px-4 py-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0 md:hidden"
                  onClick={() => setSelectedUserId(null)}
                >
                  <ArrowLeft className="size-4" />
                </Button>
                <div className="relative shrink-0">
                  {(otherUser?.image || selectedConv?.user.image) ? (
                    <img
                      src={resolveMediaUrl(
                        otherUser?.image || selectedConv?.user.image || "",
                      )}
                      alt=""
                      className="size-9 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex size-9 items-center justify-center rounded-full bg-primary/20 text-xs font-medium text-primary">
                      {(
                        otherUser?.name ||
                        selectedConv?.user.name ||
                        "?"
                      ).charAt(0)}
                    </div>
                  )}
                  <span className="absolute bottom-0 right-0">
                    <PresenceStatusIndicator
                      status={presenceStatuses[selectedUserId] ?? "offline"}
                      size="sm"
                    />
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {otherUser?.name || selectedConv?.user.name || "User"}
                  </p>
                  <p className="text-xs capitalize text-muted-foreground">
                    {presenceStatuses[selectedUserId] ?? "offline"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0"
                  onClick={() =>
                    pingUser.mutate({ receiverId: selectedUserId })
                  }
                  disabled={pingUser.isPending}
                  title="Ping"
                >
                  <Bell className="size-4" />
                </Button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-3">
                {msgsLoading ? (
                  <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Loading messages...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                    <MessageCircle className="size-10 opacity-40" />
                    <p>No messages yet. Say hi!</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {messages.map((m, idx) => {
                      const fromMe = m.senderId === myId;
                      const prev = messages[idx - 1];
                      const showTimestamp =
                        !prev ||
                        new Date(m.createdAt).getTime() -
                          new Date(prev.createdAt).getTime() >
                          5 * 60 * 1000;
                      return (
                        <div key={m.id}>
                          {showTimestamp && (
                            <p className="py-2 text-center text-[10px] text-muted-foreground">
                              {formatPostDate(m.createdAt)}
                            </p>
                          )}
                          <div
                            className={cn(
                              "flex",
                              fromMe ? "justify-end" : "justify-start",
                            )}
                          >
                            <div
                              className={cn(
                                "max-w-[75%] min-w-0 break-words rounded-2xl px-3.5 py-2 text-sm",
                                fromMe
                                  ? "rounded-br-md bg-primary text-primary-foreground"
                                  : "rounded-bl-md bg-muted text-foreground",
                              )}
                            >
                              {m.content}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Input */}
              <div className="flex items-center gap-2 border-t border-border/40 px-4 py-3">
                <Input
                  ref={inputRef}
                  placeholder="Type a message..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  className="flex-1"
                />
                <Button
                  size="icon"
                  className="shrink-0 rounded-xl"
                  onClick={handleSend}
                  disabled={!inputValue.trim() || sendMessage.isPending}
                >
                  <Send className="size-4" />
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
              <MessageCircle className="size-14 opacity-30" />
              <p className="text-sm">Select a conversation to start messaging</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
