import { Spacer } from "@awlt/design";
import { Link, useParams } from "react-router";

import Board from "@/components/board";
import useCollection from "@/hooks/useCollection";

const CollectionPage = () => {
  const { id } = useParams();

  const query = useCollection(id);
  const collection = query.data;

  if (query.isLoading) {
    return <p>Loading...</p>;
  }

  if (!collection) {
    return <p>Failed to load collection :(</p>;
  }

  return (
    <>
      <h1 className="text-2xl font-semibold">{collection.name}</h1>
      <Spacer size="2" />

      <h2 className="text-xl font-semibold">Easy puzzles</h2>
      <Spacer size="2" />
      <div className="grid w-full grid-cols-[repeat(auto-fit,minmax(40px,1fr))] gap-1">
        {collection.puzzles.slice(0, 222).map((puzzle, index) => (
          <Link key={puzzle.id} to={`/puzzles/${puzzle.id}`} className="aspect-square w-full!">
            <div className="grid h-full w-full place-items-center bg-(--gray-3)">{index + 1}</div>
          </Link>
        ))}
      </div>

      <Spacer size="10" />

      <h2 className="text-xl font-semibold">Medium puzzles</h2>
      <Spacer size="2" />
      <div className="grid w-full grid-cols-[repeat(auto-fit,minmax(40px,1fr))] gap-1">
        {collection.puzzles.slice(222, 984).map((puzzle, index) => (
          <Link key={puzzle.id} to={`/puzzles/${puzzle.id}`} className="aspect-square w-full!">
            <div className="grid h-full w-full place-items-center bg-(--gray-3)">{222 + index + 1}</div>
          </Link>
        ))}
      </div>

      <Spacer size="10" />

      <h2 className="text-xl font-semibold">Hard puzzles</h2>
      <Spacer size="2" />
      <div className="grid w-full grid-cols-[repeat(auto-fit,minmax(40px,1fr))] gap-1">
        {collection.puzzles.slice(984).map((puzzle, index) => (
          <Link key={puzzle.id} to={`/puzzles/${puzzle.id}`} className="aspect-square w-full!">
            <div className="grid h-full w-full place-items-center bg-(--gray-3)">{984 + index + 1}</div>
          </Link>
        ))}
      </div>

      <Spacer size="4" />
    </>
  );
};

export default CollectionPage;
