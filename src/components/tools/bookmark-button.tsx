"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

interface BookmarkButtonProps {
  toolId: string;
  initialBookmarked: boolean;
  userId: string | null;
}

export function BookmarkButton({
  toolId,
  initialBookmarked,
  userId,
}: BookmarkButtonProps) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    if (!userId) {
      window.location.href = "/login";
      return;
    }

    startTransition(async () => {
      const supabase = createClient();

      if (bookmarked) {
        await supabase
          .from("tool_bookmarks")
          .delete()
          .eq("user_id", userId)
          .eq("tool_id", toolId);
        setBookmarked(false);
      } else {
        await supabase
          .from("tool_bookmarks")
          .insert({ user_id: userId, tool_id: toolId });
        setBookmarked(true);
      }
    });
  }

  return (
    <Button
      variant={bookmarked ? "default" : "outline"}
      size="sm"
      onClick={handleToggle}
      disabled={isPending}
    >
      {bookmarked ? "★ 已收藏" : "☆ 收藏"}
    </Button>
  );
}
