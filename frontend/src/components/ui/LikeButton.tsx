"use client";

import { Heart } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { favoritesQueries, favoriteMutation } from "@/lib/queries";
import { useAuthStore } from "@/stores/authStore";

interface LikeButtonProps {
  id: string;
  size?: "sm" | "lg";
  className?: string;
}

export default function LikeButton({ id, size = "sm", className = "" }: LikeButtonProps) {
  const { user } = useAuthStore();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: likedIds = new Set<string>() } = useQuery({
    ...favoritesQueries.ids(),
    enabled: !!user,
  });

  const mutation = useMutation({
    ...favoriteMutation,
    onMutate: async (listingId: string) => {
      await queryClient.cancelQueries({ queryKey: ["favorites", "ids"] });
      const prev = queryClient.getQueryData<Set<string>>(["favorites", "ids"]);
      queryClient.setQueryData(["favorites", "ids"], (old: Set<string> | undefined) => {
        const next = new Set(old ?? []);
        if (next.has(listingId)) next.delete(listingId);
        else next.add(listingId);
        return next;
      });
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev !== undefined) {
        queryClient.setQueryData(["favorites", "ids"], ctx.prev);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["favorites"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "me"] });
    },
  });

  const liked = likedIds.has(id);
  const isLg = size === "lg";

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    mutation.mutate(id);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={liked ? "Remove from saved" : "Save property"}
      className={`
        ${isLg
          ? "w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 border border-white/10"
          : "w-11 h-11 rounded-full bg-black/60 hover:bg-white/90 border border-white/20 shadow-lg shadow-black/30"}
        flex items-center justify-center backdrop-blur-sm transition-all duration-150
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white
        ${liked ? "text-red-500" : "text-white hover:text-red-500"}
        ${className}
      `}
    >
      <Heart
        className={isLg ? "h-5 w-5" : "h-3.5 w-3.5"}
        fill={liked ? "currentColor" : "none"}
      />
    </button>
  );
}
