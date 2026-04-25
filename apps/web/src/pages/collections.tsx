import { Button, Dialog, IconButton, Input, Spacer } from "@awlt/design";
import { PlusIcon } from "lucide-react";
import { useState } from "react";

import { isHttpError } from "@/utils/http-error";

const CollectionsPage = () => {
  const [collectionName, setCollectionName] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const handleCollectionCreate = async () => {
    setFieldError(null);
    setFormError(null);

    try {
      // const playlist = await createPlaylist(playlistName);
      // toastManager.add({
      //   title: "Created playlist",
      //   description: `Playlist ${playlist.name} was created!`,
      //   type: "success",
      //   actionProps: {
      //     children: "View playlist",
      //     onClick: () => {
      //       navigate(`/playlists/${playlist.id}`);
      //     },
      //   },
      // });
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
    </div>
  );
};

export default CollectionsPage;
