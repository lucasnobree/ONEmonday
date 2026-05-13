"use client";

import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
} from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface User {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
}

interface UserAvatarGroupProps {
  users: User[];
  max?: number;
  size?: "sm" | "default";
}

export function UserAvatarGroup({
  users,
  max = 3,
  size = "sm",
}: UserAvatarGroupProps) {
  const visible = users.slice(0, max);
  const remaining = users.length - max;

  return (
    <TooltipProvider>
      <AvatarGroup>
        {visible.map((user) => (
          <Tooltip key={user.user_id}>
            <TooltipTrigger render={<div />}>
              <Avatar size={size}>
                <AvatarFallback>
                  {user.full_name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent>{user.full_name}</TooltipContent>
          </Tooltip>
        ))}
        {remaining > 0 && (
          <AvatarGroupCount>+{remaining}</AvatarGroupCount>
        )}
      </AvatarGroup>
    </TooltipProvider>
  );
}
