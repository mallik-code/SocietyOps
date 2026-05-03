#!/bin/bash
# Creates the application database for api-server alongside the Evolution API database.
# Runs once on first container start (postgres entrypoint convention).
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE DATABASE complaint;
    CREATE DATABASE knowledge;
    CREATE DATABASE societyops;
    GRANT ALL PRIVILEGES ON DATABASE complaint TO $POSTGRES_USER;
    GRANT ALL PRIVILEGES ON DATABASE knowledge TO $POSTGRES_USER;
    GRANT ALL PRIVILEGES ON DATABASE societyops TO $POSTGRES_USER;
EOSQL