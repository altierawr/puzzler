import { useQuery } from "@tanstack/react-query";

import type { Puzzle } from "@/types";

import { request } from "../utils/http";

const usePuzzle = (id?: string, collectionId?: string) => {
  return useQuery({
    queryKey: ["puzzle", id, collectionId],
    queryFn: async () => {
      const url = collectionId !== undefined ? `/collections/${collectionId}/puzzles/${id}` : `/puzzles/${id}`;
      const resp = await request(url);
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
