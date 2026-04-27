import { Button, Dialog, IconButton, Input, Spacer, toastManager } from "@awlt/design";
import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import useCollectionActions from "@/hooks/useCollectionActions";
import useCollections from "@/hooks/useCollections";
import { isHttpError } from "@/utils/http-error";

const CollectionsPage = () => {
  const [collectionName, setCollectionName] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const { createCollection } = useCollectionActions();
  const collections = useCollections();

  const handleCollectionCreate = async () => {
    setFieldError(null);
    setFormError(null);

    try {
      const collection = await createCollection(collectionName);
      toastManager.add({
        title: "Created collection",
        description: `Collection ${collection.name} was created!`,
        type: "success",
      });
    } catch (error) {
      if (isHttpError<{ error?: Record<string, string> }>(error)) {
        if (error.status === 422 && error.data?.error?.name) {
          setFieldError(`Name ${error.data.error.name}`);
        } else {
          setFormError("Something went wrong");
        }
      }
    }
  };

  return (
    <div className="grid">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Collections</h1>
        <Dialog.Root>
          <Dialog.Trigger
            render={
              <IconButton size="sm" color="blue">
                <PlusIcon />
              </IconButton>
            }
          />
          <Dialog.Popup>
            <Dialog.Header>
              <Dialog.Title>Create a new puzzle collection</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Dialog.Description>Enter a name for your collection</Dialog.Description>
              <Input
                className="w-full"
                value={collectionName}
                onChange={(e) => setCollectionName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.code === "Enter") {
                    handleCollectionCreate();
                  }
                }}
                errors={fieldError ? [fieldError] : undefined}
              />
              {formError && <p className="text-sm text-(--red-11)">{formError}</p>}
            </Dialog.Body>
            <Dialog.Footer>
              <Dialog.Close>Cancel</Dialog.Close>
              <Button color="blue" onClick={handleCollectionCreate}>
                Create collection
              </Button>
            </Dialog.Footer>
          </Dialog.Popup>
        </Dialog.Root>
      </div>
      <Spacer size="8" />

      {collections.data && (
        <div className="grid w-full gap-2">
          {collections.data.map((collection) => (
            <Link
              to={`/collections/${collection.id}`}
              key={collection.id}
              className="w-full! rounded-md bg-(--gray-3) px-5 py-3"
            >
              <p>{collection.name}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default CollectionsPage;
