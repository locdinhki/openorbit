---
site: upwork.com/jobs
lastFullScan: ""
lastVerified: ""
---

## search_jobs

### navigate_to_search
- **selectors**: (none)
- **textMatches**: (none)
- **ariaLabels**: (none)
- **location**: url
- **elementType**: navigation
- **fallback**: Navigate to Upwork job search URL with query parameters
- **confidence**: 0.9

### wait_for_results
- **selectors**: `[data-test='job-tile-list']`, `.up-card-list-section`, `.job-tile`, `section.air3-grid-container`
- **textMatches**: (none)
- **ariaLabels**: (none)
- **location**: main
- **elementType**: container
- **fallback**: Wait for job search results container to appear
- **confidence**: 0.75

## extract_job_cards

### find_job_cards
- **selectors**: `[data-test='job-tile-list'] article`, `.job-tile`, `section[data-test='JobTile']`, `article.air3-card-section`
- **textMatches**: (none)
- **ariaLabels**: (none)
- **location**: [data-test='job-tile-list']
- **elementType**: article, section
- **fallback**: Find all job tile elements in search results
- **confidence**: 0.7

## extract_card_title

### get_job_title
- **selectors**: `[data-test='job-tile-title-link'] h2`, `.job-tile-title a`, `h2.my-0 a`, `a.up-n-link`
- **textMatches**: (none)
- **ariaLabels**: (none)
- **location**: .job-tile, article
- **elementType**: a, h2
- **fallback**: Extract job title from tile
- **confidence**: 0.75

## extract_card_company

### get_client_info
- **selectors**: `[data-test='client-info']`, `.client-info`, `.up-n-link.text-muted`, `small.text-muted`
- **textMatches**: (none)
- **ariaLabels**: (none)
- **location**: .job-tile, article
- **elementType**: div, small
- **fallback**: Extract client info from tile
- **confidence**: 0.7

## extract_job_details

### get_job_description
- **selectors**: `[data-test='job-description-text']`, `.job-description`, `.up-line-clamp-v2`, `div.break.mb-0`
- **textMatches**: (none)
- **ariaLabels**: (none)
- **location**: .job-tile, main
- **elementType**: div
- **fallback**: Extract full job description from detail
- **confidence**: 0.75

### get_budget_info
- **selectors**: `[data-test='budget']`, `[data-test='is-fixed-price']`, `.up-monetary`, `strong.text-body-sm`
- **textMatches**: `$`, `Fixed-price`, `Hourly`, `/hr`, `Budget`
- **ariaLabels**: (none)
- **location**: .job-tile, main
- **elementType**: span, strong
- **fallback**: Extract budget/rate info from job detail
- **confidence**: 0.7

### get_skills_required
- **selectors**: `[data-test='token']`, `.up-skill-badge`, `.air3-token`, `span.badge`
- **textMatches**: (none)
- **ariaLabels**: (none)
- **location**: .job-tile, main
- **elementType**: span
- **fallback**: Extract required skills tags
- **confidence**: 0.7

## next_page

### click_next_page
- **selectors**: `button[data-test='pagination-next']`, `.up-pagination-next`, `nav[aria-label='Pagination'] button:last-child`
- **textMatches**: (none)
- **ariaLabels**: `Next`, `Next page`
- **location**: nav[aria-label='Pagination']
- **elementType**: button
- **fallback**: Click next page button in pagination
- **confidence**: 0.7
