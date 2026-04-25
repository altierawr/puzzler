package main

import (
	"fmt"
	"log/slog"
	"os"
	"strconv"
	"sync"

	"github.com/altierawr/puzzler/internal/auth"
	"github.com/altierawr/puzzler/internal/data"
	"github.com/altierawr/puzzler/internal/database"
	"github.com/joho/godotenv"
	"github.com/lmittmann/tint"
)

type config struct {
	env   string
	port  int
	tidal struct {
		accessToken  string
		refreshToken string
		clientId     string
		secret       string
	}
	lastFm struct {
		apiKey string
	}
	secrets struct {
		accessToken  string
		refreshToken string
	}
	limiter struct {
		rps     float64
		burst   int
		enabled bool
	}
	db struct {
		dsn string
	}
}

type application struct {
	config config
	logger *slog.Logger
	auth   auth.AuthService
	wg     sync.WaitGroup
	db     *database.DB
}

func main() {
	logger := slog.New(tint.NewHandler(os.Stdout, &tint.Options{Level: slog.LevelDebug}))

	err := godotenv.Load()
	if err != nil {
		logger.Warn("could not load .env file")
	}

	var cfg config

	found := false
	cfg.secrets.accessToken, found = os.LookupEnv("ACCESS_TOKEN_SECRET")
	if !found {
		logger.Error("missing env variable ACCESS_TOKEN_SECRET")
		os.Exit(1)
	}

	cfg.secrets.refreshToken, found = os.LookupEnv("REFRESH_TOKEN_SECRET")
	if !found {
		logger.Error("missing env variable REFRESH_TOKEN_SECRET")
		os.Exit(1)
	}

	auth.SetTokenSecrets(cfg.secrets.accessToken, cfg.secrets.refreshToken)

	env, found := os.LookupEnv("ENV")
	if found {
		cfg.env = env
	} else {
		cfg.env = "production"
	}

	cfg.db.dsn, found = os.LookupEnv("DB_DSN")
	if !found {
		logger.Warn("missing env variable DB_DSN")
		cfg.db.dsn = "user:pass@localhost:5432/db"
	}

	db, err := database.New(cfg.db.dsn, logger)
	if err != nil {
		logger.Error(err.Error())
		os.Exit(1)
	}
	defer db.Close()

	logger.Info("database connected")

	err = db.MigrateUp()
	if err != nil {
		logger.Error(err.Error())
		os.Exit(1)
	}

	cfg.limiter.enabled = true
	cfg.limiter.rps = 6
	cfg.limiter.burst = 24

	cfg.port, err = getPort()
	if err != nil {
		logger.Error(err.Error())
		os.Exit(1)
	}

	app := &application{
		logger: logger,
		config: cfg,
		db:     db,
		auth: auth.AuthService{
			DB: db,
		},
	}

	createdAdmin, err := createAdminUser(app)
	if err != nil {
		logger.Error(err.Error())
		os.Exit(1)
	}

	if createdAdmin {
		logger.Info("created admin user")
	}

	err = app.serve()
	if err != nil {
		logger.Error("server stopped with error", "error", err)
		os.Exit(1)
	}
}

func getPort() (int, error) {
	const defaultPort = 3004

	rawPort, found := os.LookupEnv("PORT")
	if !found {
		return defaultPort, nil
	}

	port, err := strconv.Atoi(rawPort)
	if err != nil {
		return 0, fmt.Errorf("invalid PORT value %q: expected integer", rawPort)
	}

	if port < 1 || port > 65535 {
		return 0, fmt.Errorf("invalid PORT value %q: must be between 1 and 65535", rawPort)
	}

	return port, nil
}

func createAdminUser(app *application) (bool, error) {
	admins, err := app.db.GetAdminUsers()
	if err != nil {
		return false, err
	}

	// Already have admin, don't need to create one
	if len(admins) > 0 {
		return false, nil
	}

	user := &data.User{
		Username: "admin",
		IsAdmin:  true,
	}

	err = user.Password.Set("password")
	if err != nil {
		return false, err
	}

	err = app.db.InsertUser(user)

	if err != nil {
		return false, err
	}

	return true, nil
}
