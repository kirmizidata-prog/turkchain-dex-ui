# Turkchain Token Lists

This repository contains token lists and token logos used by Turkchain DEX UI.

## Lists
- Official list (maintainers only):
  tokenlists/lists/official.tokenlist.json
- Community list (via PR):
  tokenlists/lists/community.tokenlist.json

## Logos
Logos are stored as:
tokenlists/logos/1919/<token_address>/logo.png

Example:
tokenlists/logos/1919/0xYourTokenAddress/logo.png

PNG recommended:
- square
- 256x256
- transparent background (optional)

## How the UI loads lists
The UI fetches token lists from GitHub raw URLs configured via:
- NEXT_PUBLIC_TOKENLIST_OFFICIAL_URL
- NEXT_PUBLIC_TOKENLIST_COMMUNITY_URL

## Community contribution flow
1) Open an Issue (optional) using the token listing template.
2) Fork this repo.
3) Add your token to community.tokenlist.json
4) Add logo.png under tokenlists/logos/1919/<address>/logo.png
5) Open a Pull Request.

Maintainers will review and merge.
