import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { Collection } from "../types";
import { request } from "../utils/http";
import { createHttpError } from "../utils/http-error";

type MutationActionOptions<TData> = {
  onSuccess?: (data: TData) => void;
  onError?: (error: unknown) => void;
  onSettled?: () => void;
};

const useCollectionActions = () => {
  const queryClient = useQueryClient();

  const createCollectionMutation = useMutation({
    mutationFn: async (name: string) => {
      const resp = await request("/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!resp.ok) {
        throw await createHttpError(resp, "failed to create collection");
      }

      return (await resp.json()) as Collection;
    },
    onSuccess: (collection) => {
      queryClient.setQueryData<Collection[]>(["collections"], (current) => {
        if (!current) {
          return [collection];
        }

        return [collection, ...current];
      });

      queryClient.setQueryData<Collection>(["collection", collection.id], {
        ...collection,
      });

      queryClient.invalidateQueries({ queryKey: ["collections"] });
    },
  });

  const createCollection = async (name: string, options?: MutationActionOptions<Collection>) => {
    try {
      const collection = await createCollectionMutation.mutateAsync(name);
      options?.onSuccess?.(collection);
      return collection;
    } catch (error) {
      options?.onError?.(error);
      throw error;
    } finally {
      options?.onSettled?.();
    }
  };

  return {
    createCollection: createCollection,
    isCreatingCollection: createCollectionMutation.isPending,
  };
};

export default useCollectionActions;
