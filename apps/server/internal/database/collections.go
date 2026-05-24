package database

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/altierawr/puzzler/internal/data"
	"github.com/altierawr/puzzler/utils"
	"github.com/gofrs/uuid"
)

func (db *DB) CreateCollection(userId uuid.UUID, name string) (*data.Collection, error) {
	query := `INSERT INTO collections (id, name, created_by) VALUES ($1, $2, $3)`

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	id, err := utils.GenerateAlphabeticId(8)
	if err != nil {
		return nil, err
	}

	_, err = db.ExecContext(ctx, query, id, name, userId)
	if err != nil {
		return nil, err
	}

	return &data.Collection{
		ID:   id,
		Name: name,
	}, nil
}

func (db *DB) DeleteCollection(id string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	tx, err := db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// 1. Create a temp table of the puzzle IDs in this collection so we can reference them after deletion
	_, err = tx.ExecContext(ctx, `
		CREATE TEMP TABLE temp_puzzles ON COMMIT DROP AS
		SELECT puzzles_id FROM collections_puzzles WHERE collections_id = $1
	`, id)
	if err != nil {
		return err
	}

	// 2. Delete puzzle solves for the puzzles in this collection
	_, err = tx.ExecContext(ctx, `
		DELETE FROM puzzle_solves
		WHERE puzzles_id IN (SELECT puzzles_id FROM temp_puzzles)
	`)
	if err != nil {
		return err
	}

	// 3. Delete collections_puzzles associations for these puzzles and for the collection itself
	_, err = tx.ExecContext(ctx, `
		DELETE FROM collections_puzzles
		WHERE puzzles_id IN (SELECT puzzles_id FROM temp_puzzles)
		   OR collections_id = $1
	`, id)
	if err != nil {
		return err
	}

	// 4. Delete the puzzles themselves
	_, err = tx.ExecContext(ctx, `
		DELETE FROM puzzles
		WHERE id IN (SELECT puzzles_id FROM temp_puzzles)
	`)
	if err != nil {
		return err
	}

	// 5. Delete the collection itself
	_, err = tx.ExecContext(ctx, `
		DELETE FROM collections
		WHERE id = $1
	`, id)
	if err != nil {
		return err
	}

	return tx.Commit()
}

func (db *DB) AddPuzzlesToCollection(collectionId string, puzzleIds []string) error {
	if len(puzzleIds) == 0 {
		return nil
	}

	query := `INSERT INTO collections_puzzles (collections_id, puzzles_id) VALUES `
	args := []any{}

	for i, puzzleId := range puzzleIds {
		if i > 0 {
			query += ", "
		}
		query += fmt.Sprintf("($%d, $%d)", i*2+1, i*2+2)
		args = append(args, collectionId, puzzleId)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	_, err := db.ExecContext(ctx, query, args...)
	return err
}

func (db *DB) CountCollectionPuzzles(collectionId string) (int, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	var count int
	err := db.QueryRowContext(ctx, `SELECT COUNT(*) FROM collections_puzzles WHERE collections_id = $1`, collectionId).Scan(&count)
	return count, err
}

func (db *DB) GetCollections() (*[]data.Collection, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	collectionQuery := `
		SELECT * FROM collections
	`

	collections := []data.Collection{}
	err := db.SelectContext(ctx, &collections, collectionQuery)

	return &collections, err
}

func (db *DB) GetCollection(id string, userId uuid.UUID) (*data.Collection, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	collectionQuery := `
		SELECT * FROM collections WHERE id = $1
	`

	collection := data.Collection{}
	err := db.GetContext(ctx, &collection, collectionQuery, id)
	if err != nil {
		switch {
		case errors.Is(err, sql.ErrNoRows):
			return nil, ErrRecordNotFound
		default:
			return nil, err
		}
	}

	puzzlesQuery := `
		SELECT
			p.id,
			p.name,
			p.fen,
			p.visibility,
			ps.status
		FROM collections_puzzles
		JOIN puzzles p ON p.id = collections_puzzles.puzzles_id
		LEFT JOIN puzzle_solves ps ON ps.puzzles_id = p.id AND ps.users_id = $2
		WHERE collections_puzzles.collections_id = $1
		ORDER BY p.created_at ASC
	`

	rows, err := db.QueryContext(ctx, puzzlesQuery, id, userId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	collection.Puzzles = []data.Puzzle{}
	for rows.Next() {
		puzzle := data.Puzzle{}

		err = rows.Scan(
			&puzzle.ID,
			&puzzle.Name,
			&puzzle.Fen,
			&puzzle.Visibility,
			&puzzle.SolveStatus,
		)
		if err != nil {
			return nil, err
		}

		collection.Puzzles = append(collection.Puzzles, puzzle)
	}

	return &collection, rows.Err()
}
