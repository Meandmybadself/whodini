![whodini](media/logo.png)

Whodini is a Slack application to help identify subject knowledge experts.

## Tech

* PostGRES
* Node
* Express
* TypeScript

## Environment variables

* `PORT`
* `NODE_ENV`
* `SILENT` - 1 to silence postgres queries
* `DB_DATABASE`
* `DB_HOST`
* `DB_INIT_BASE_TABLES` - On startup, initialize tables
* `DB_USERNAME`
* `DB_PASSWORD`
* `DB_PORT`
* `SLACK_APP_ID`
* `SLACK_APP_MANIFEST_URL`
* `SLACK_CLIENT_ID`
* `SLACK_CLIENT_SECRET`
* `SLACK_SIGNING_SECRET`
* `HOSTNAME`

## Github Actions secrets

* `HOST` - SSH host
* `USERNAME` - SSH username
* `KEY` - SSH public key
* `PORT` - SSH port
* `CWD` - SSH working directory

## Todos

* Introduce fuzzy text search
* Fix edit profile response (currently results in UI error)