# Contributing: Token Listing

## Requirements
- Token must be deployed on Turkchain (chainId 1919)
- Provide correct: address, symbol, decimals, name
- Provide a logo.png

## Steps (Fork + PR)
1) Fork the repo on GitHub.
2) Clone your fork locally.
3) Create a branch:
   git checkout -b add-token-<symbol>

4) Add token entry to:
   tokenlists/lists/community.tokenlist.json

5) Add logo file:
   tokenlists/logos/1919/<token_address>/logo.png

6) Validate JSON locally:
   node -e "JSON.parse(require('fs').readFileSync('tokenlists/lists/community.tokenlist.json','utf8')); console.log('ok');"

7) Commit and push:
   git add tokenlists
   git commit -m "Add <SYMBOL> token"
   git push origin add-token-<symbol>

8) Open a Pull Request from your branch.

## Review process
- Maintainers verify:
  - address format
  - decimals match on-chain
  - symbol/name quality
  - logo file exists
- If approved: PR is merged and token appears in the UI.

## Token listing
- Docs: tokenlists/README.md
- Contributing: CONTRIBUTING.md
- Community list file: tokenlists/lists/community.tokenlist.json
- Logo path: tokenlists/logos/1919/<address>/logo.png

### Submit token
Open a token request issue:
https://github.com/Turkchain1919/turkchain-dex-ui/issues/new?template=token_listing_request.yml

Or submit a PR:
1) Fork
2) Add token entry + logo
3) Open PR
4) CI must be green (tokenlists-validate)
5) Maintainers review and merge
