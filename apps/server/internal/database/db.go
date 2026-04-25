package database

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/altierawr/puzzler/assets"
	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	"github.com/jmoiron/sqlx"

	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/lib/pq"
)

var (
	ErrRecordNotFound = errors.New("record not found")
	ErrEditConflict   = errors.New("edit conflict")
)

type DB struct {
	dsn                string
	logger             *slog.Logger
	onTidalTrackUpsert func(trackID int64)
	*sqlx.DB
}

func (db *DB) SetOnTidalTrackUpsert(fn func(trackID int64)) {
	db.onTidalTrackUpsert = fn
}

func New(dsn string, logger *slog.Logger) (*DB, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	db, err := sqlx.ConnectContext(
		ctx,
		"postgres",
		fmt.Sprintf("postgres://%s", dsn),
	)
	if err != nil {
		return nil, err
	}

	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(25)
	db.SetConnMaxIdleTime(5 * time.Minute)
	db.SetConnMaxLifetime(2 * time.Hour)

	return &DB{
		DB:     db,
		dsn:    dsn,
		logger: logger,
	}, nil
}

func (db *DB) MigrateUp() error {
	iofsDriver, err := iofs.New(assets.EmbeddedFiles, "migrations")
	if err != nil {
		return err
	}

	migrator, err := migrate.NewWithSourceInstance("iofs", iofsDriver, "postgres://"+db.dsn)
	if err != nil {
		return err
	}

	err = migrator.Up()

	if err == nil {
		db.logger.Info("applied up migrations")
		return nil
	}

	switch {
	case errors.Is(err, migrate.ErrNoChange):
		return nil
	default:
		return err
	}
}
