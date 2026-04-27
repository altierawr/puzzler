package database

import (
	"context"
	"database/sql"
	"errors"
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

func (db *DB) GetCollection(id string) (*data.Collection, error) {
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
			p.fen
		FROM collections_puzzles
		JOIN puzzles p ON p.id = collections_puzzles.puzzles_id
		WHERE collections_puzzles.collections_id = $1
		ORDER BY p.created_at ASC
	`

	rows, err := db.QueryContext(ctx, puzzlesQuery, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		puzzle := data.Puzzle{}

		err = rows.Scan(
			&puzzle.ID,
			&puzzle.Name,
			&puzzle.Fen,
		)
		if err != nil {
			return nil, err
		}

		collection.Puzzles = append(collection.Puzzles, puzzle)
	}

	return &collection, rows.Err()
}
