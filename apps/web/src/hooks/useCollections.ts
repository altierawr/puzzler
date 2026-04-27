import { useQuery } from "@tanstack/react-query";

import type { Collection } from "../types";
import { request } from "../utils/http";

const useCollections = () => {
  return useQuery({
    queryKey: ["collections"],
    queryFn: async () => {
      const resp = await request(`/collections`);
      if (!resp.ok) {
        throw new Error(`failed to fetch collections (${resp.status})`);
      }

      return (await resp.json()) as Collection[];
    },
    retry: false,
  });
};

export default useCollections;
