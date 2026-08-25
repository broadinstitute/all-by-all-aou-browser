# axaou-ui

## Starting the browser

Run `pnpm start` (or `pnpm start-local-api`) from this directory. Local PouchDB
query caching is enabled in ordinary development and production startup. Set
`CACHE_ENABLED=false pnpm start` to explicitly disable it while debugging.
The cache name is stable across frontend rebuilds and is invalidated when the
API reports a new `data_version`.

## Starting the python server

Executing `./start-python.sh` performs a check for the presence of test input tables and downloads them from Google Cloud Storage if they are missing. The script also initiates the pipeline to generate files needed for the API, provided these files do not already exist. The pipeline is only re-triggered if there are changes in the `types` or `schema` directories in the `axaou_browser_data` package.

API docs: <http://localhost:8889/redoc>

Hybrid Dataset UI: <http://localhost:8889/static/index.html>

