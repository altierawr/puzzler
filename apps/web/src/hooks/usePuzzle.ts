import { useQuery } from "@tanstack/react-query";

import type { Puzzle } from "@/types";

import { request } from "../utils/http";

const usePuzzle = (id?: string) => {
  return useQuery({
    queryKey: ["puzzle", id],
    queryFn: async () => {
      const resp = await request(`/puzzles/${id}`);
      if (!resp.ok) {
        throw new Error(`failed to fetch puzzle (${resp.status})`);
      }

      return (await resp.json()) as Puzzle;
    },
    enabled: id !== undefined,
    retry: false,
  });
};

export default usePuzzle;
