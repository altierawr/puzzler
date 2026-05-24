import { Button, Spacer, toastManager } from "@awlt/design";
import clsx from "clsx";
import { Link, useNavigate, useParams } from "react-router";

import useCollection from "@/hooks/useCollection";
import useCurrentUser from "@/hooks/useCurrentUser";
import { request } from "@/utils/http";

const CollectionPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useCurrentUser();

  const query = useCollection(id);
  const collection = query.data;

  if (query.isLoading) {
    return <p>Loading...</p>;
  }

  if (!collection) {
    return <p>Failed to load collection :(</p>;
  }

  const deleteCollection = async () => {
    const resp = await request(`/collections/${id}`, { method: "DELETE" });
    if (resp.ok) {
      toastManager.add({ title: "Collection deleted", type: "success" });
      navigate("/");
    } else {
      toastManager.add({ title: "Failed to delete collection", type: "error" });
    }
  };

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">{collection.name}</h1>
        {user?.isAdmin && (
          <Button color="red" variant="soft" onClick={deleteCollection}>
            Delete collection
          </Button>
        )}
      </div>
      <Spacer size="2" />

      <h2 className="text-xl font-semibold">Easy puzzles</h2>
      <Spacer size="2" />
      <div className="grid w-full grid-cols-[repeat(auto-fit,minmax(40px,1fr))] gap-1">
        {collection.puzzles.slice(0, 222).map((puzzle, index) => (
          <Link key={puzzle.id} to={`/collections/${id}/puzzles/${puzzle.id}`} className="aspect-square w-full!">
            <div
              className={clsx(
                "grid h-full w-full place-items-center bg-(--gray-3)",
                puzzle.solveStatus === "fail" && "bg-(--red-3)",
                puzzle.solveStatus === "success" && "bg-(--green-3)",
              )}
            >
              {index + 1}
            </div>
          </Link>
        ))}
      </div>

      <Spacer size="10" />

      <h2 className="text-xl font-semibold">Medium puzzles</h2>
      <Spacer size="2" />
      <div className="grid w-full grid-cols-[repeat(auto-fit,minmax(40px,1fr))] gap-1">
        {collection.puzzles.slice(222, 984).map((puzzle, index) => (
          <Link key={puzzle.id} to={`/collections/${id}/puzzles/${puzzle.id}`} className="aspect-square w-full!">
            <div
              className={clsx(
                "grid h-full w-full place-items-center bg-(--gray-3)",
                puzzle.solveStatus === "fail" && "bg-(--red-3)",
                puzzle.solveStatus === "success" && "bg-(--green-3)",
              )}
            >
              {222 + index + 1}
            </div>
          </Link>
        ))}
      </div>

      <Spacer size="10" />

      <h2 className="text-xl font-semibold">Hard puzzles</h2>
      <Spacer size="2" />
      <div className="grid w-full grid-cols-[repeat(auto-fit,minmax(40px,1fr))] gap-1">
        {collection.puzzles.slice(984).map((puzzle, index) => (
          <Link key={puzzle.id} to={`/collections/${id}/puzzles/${puzzle.id}`} className="aspect-square w-full!">
            <div
              className={clsx(
                "grid h-full w-full place-items-center bg-(--gray-3)",
                puzzle.solveStatus === "fail" && "bg-(--red-3)",
                puzzle.solveStatus === "success" && "bg-(--green-3)",
              )}
            >
              {984 + index + 1}
            </div>
          </Link>
        ))}
      </div>

      <Spacer size="4" />
    </>
  );
};

export default CollectionPage;
