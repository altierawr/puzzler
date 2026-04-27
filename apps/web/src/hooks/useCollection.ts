import { useQuery } from "@tanstack/react-query";

import type { Collection } from "../types";
import { request } from "../utils/http";

const useCollection = (id?: string) => {
  return useQuery({
    queryKey: ["collection", id],
    queryFn: async () => {
      const resp = await request(`/collections/${id}`);
      if (!resp.ok) {
        throw new Error(`failed to fetch collection (${resp.status})`);
      }

      return (await resp.json()) as Collection;
    },
    enabled: id !== undefined,
    retry: false,
  });
};

export default useCollection;
