Sentinel Cost Loading Intelligence - Patch 05B

Files:
  src/components/CostLoadingIntelligence.jsx
  src/utils/costLoadingAllocationValidation.js

Install from the feature/cost-loading-intelligence Codespace root:
  unzip -o Sentinel-CostLoading-Patch-05B.zip
  npm run build
  npm run dev

Upload the original XER, then upload the completed Patch 05A workbook under
"Import approved activity allocations". The import recomputes all allocations
from approved pool amounts, selected activity IDs and weights, ignoring Excel
formula results. It is review-only and never edits the XER.

For a basic smoke test, upload an untouched 05A workbook: expect zero approved
pools and an unapproved-template warning. To test an approved pool, fill CLIN,
approved amount, activity IDs, YES selections, and weights totaling 100%.

IMPORTANT: This is not an XER writer. The construction holding resource
assignment balance and design cost preservation require later verification.
