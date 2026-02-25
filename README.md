Contributing: Token Listing
Requirements
Token must be deployed on Turkchain (chainId 1919)
Provide correct: address, symbol, decimals, name
Provide a logo.png
Steps (Fork + PR)
Fork the repo on GitHub.

Clone your fork locally.

Create a branch: git checkout -b add-token-

Add token entry to: tokenlists/lists/community.tokenlist.json

Add logo file: tokenlists/logos/1919/<token_address>/logo.png

Validate JSON locally: node -e "JSON.parse(require('fs').readFileSync('tokenlists/lists/community.tokenlist.json','utf8')); console.log('ok');"

Commit and push: git add tokenlists git commit -m "Add token" git push origin add-token-

Open a Pull Request from your branch.

Review process
Maintainers verify:
address format
decimals match on-chain
symbol/name quality
logo file exists
If approved: PR is merged and token appears in the UI.
