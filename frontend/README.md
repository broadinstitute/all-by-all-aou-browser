# axaou-ui

## Starting the python server

Executing `./start-python.sh` performs a check for the presence of test input tables and downloads them from Google Cloud Storage if they are missing. The script also initiates the pipeline to generate files needed for the API, provided these files do not already exist. The pipeline is only re-triggered if there are changes in the `types` or `schema` directories in the `axaou_browser_data` package.

API docs: <http://localhost:8889/redoc>

Hybrid Dataset UI: <http://localhost:8889/static/index.html>

