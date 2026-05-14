"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

let channelCounter = 0;

export function useRealtimeBoard(boardId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!boardId) return;

    const supabase = createClient();
    const channelName = `board:${boardId}:${++channelCounter}`;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cards",
          filter: `board_id=eq.${boardId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["board", boardId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [boardId, queryClient]);
}
