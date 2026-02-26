---
site: linkedin.com/jobs
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
- **fallback**: Navigate to LinkedIn job search URL with query parameters
- **confidence**: 0.95

### wait_for_results
- **selectors**: `.jobs-search-results-list`, `.scaffold-layout__list`, `[class*='jobs-search-results']`, `.jobs-search__results-list`
- **textMatches**: (none)
- **ariaLabels**: (none)
- **location**: main
- **elementType**: container
- **fallback**: Wait for job search results container to appear
- **confidence**: 0.85

## extract_job_cards

### find_job_cards
- **selectors**: `.job-card-container`, `.jobs-search-results__list-item`, `li.ember-view.occludable-update`, `[data-occludable-job-id]`, `.scaffold-layout__list-item`
- **textMatches**: (none)
- **ariaLabels**: (none)
- **location**: .jobs-search-results-list, .scaffold-layout__list
- **elementType**: li
- **fallback**: Find all job card list items in search results
- **confidence**: 0.8

## extract_card_title

### get_job_title
- **selectors**: `.job-card-list__title`, `.job-card-container__link`, `a[class*='job-card-list__title']`, `.artdeco-entity-lockup__title a`, `a.job-card-container__link`
- **textMatches**: (none)
- **ariaLabels**: (none)
- **location**: .job-card-container
- **elementType**: a
- **fallback**: Extract job title text from card link
- **confidence**: 0.85

## extract_card_company

### get_company_name
- **selectors**: `.job-card-container__primary-description`, `.artdeco-entity-lockup__subtitle`, `.job-card-container__company-name`, `span.job-card-container__primary-description`
- **textMatches**: (none)
- **ariaLabels**: (none)
- **location**: .job-card-container
- **elementType**: span
- **fallback**: Extract company name from card
- **confidence**: 0.8

## extract_card_location

### get_job_location
- **selectors**: `.job-card-container__metadata-item`, `.artdeco-entity-lockup__caption`, `.job-card-container__metadata-wrapper li`, `span.job-card-container__metadata-item`
- **textMatches**: (none)
- **ariaLabels**: (none)
- **location**: .job-card-container
- **elementType**: span
- **fallback**: Extract location from card metadata
- **confidence**: 0.75

## extract_card_easy_apply

### check_easy_apply
- **selectors**: `.job-card-container__apply-method`, `[class*='easy-apply']`, `.job-card-container__footer-item`
- **textMatches**: `Easy Apply`, `easy apply`
- **ariaLabels**: (none)
- **location**: .job-card-container
- **elementType**: span
- **fallback**: Check if job card has Easy Apply badge
- **confidence**: 0.8

## click_job_card

### click_to_view_details
- **selectors**: `.job-card-list__title`, `.job-card-container__link`, `a[class*='job-card-list__title']`, `a.job-card-container__link`
- **textMatches**: (none)
- **ariaLabels**: (none)
- **location**: .job-card-container
- **elementType**: a
- **fallback**: Click on job card title link to load details
- **confidence**: 0.85

## extract_job_details

### get_job_description
- **selectors**: `.jobs-description__content`, `.jobs-description-content__text`, `#job-details`, `.jobs-box__html-content`, `[class*='jobs-description']`
- **textMatches**: (none)
- **ariaLabels**: (none)
- **location**: .jobs-search__job-details, .scaffold-layout__detail
- **elementType**: div
- **fallback**: Extract full job description from detail panel
- **confidence**: 0.8

### get_detail_title
- **selectors**: `.job-details-jobs-unified-top-card__job-title`, `.jobs-unified-top-card__job-title`, `.t-24.t-bold`, `h1 a`, `h2.job-details-jobs-unified-top-card__job-title`
- **textMatches**: (none)
- **ariaLabels**: (none)
- **location**: .jobs-search__job-details, .scaffold-layout__detail
- **elementType**: h1, h2, a
- **fallback**: Extract job title from detail panel header
- **confidence**: 0.8

### get_detail_company
- **selectors**: `.job-details-jobs-unified-top-card__company-name`, `.jobs-unified-top-card__company-name`, `.job-details-jobs-unified-top-card__primary-description-container a`
- **textMatches**: (none)
- **ariaLabels**: (none)
- **location**: .jobs-search__job-details, .scaffold-layout__detail
- **elementType**: a, span
- **fallback**: Extract company name from detail panel
- **confidence**: 0.8

### get_detail_salary
- **selectors**: `.job-details-jobs-unified-top-card__job-insight span`, `[class*='salary']`, `.compensation__salary`
- **textMatches**: `$`, `/yr`, `/hr`, `per hour`, `per year`, `annually`
- **ariaLabels**: (none)
- **location**: .jobs-search__job-details, .scaffold-layout__detail
- **elementType**: span
- **fallback**: Extract salary info from detail panel
- **confidence**: 0.6

### get_detail_posted_date
- **selectors**: `.job-details-jobs-unified-top-card__primary-description-container span`, `time`, `[class*='posted-date']`, `.jobs-unified-top-card__posted-date`
- **textMatches**: `ago`, `hour`, `day`, `week`, `month`, `Reposted`
- **ariaLabels**: (none)
- **location**: .jobs-search__job-details, .scaffold-layout__detail
- **elementType**: span, time
- **fallback**: Extract posted date from detail panel
- **confidence**: 0.7

## next_page

### click_next_page
- **selectors**: `button[aria-label='Page {next}']`, `.artdeco-pagination__button--next`, `li.artdeco-pagination__indicator--number button`, `[class*='pagination'] button[aria-label*='Next']`
- **textMatches**: (none)
- **ariaLabels**: `Next`, `Page {next}`
- **location**: .artdeco-pagination, .jobs-search-pagination
- **elementType**: button
- **fallback**: Click next page button in pagination
- **confidence**: 0.8

## check_authentication

### verify_logged_in
- **selectors**: `.global-nav__me-photo`, `.feed-identity-module__actor-meta`, `img.global-nav__me-photo`, `.global-nav__primary-link-me-menu-trigger`
- **textMatches**: (none)
- **ariaLabels**: `Profile`, `Me`
- **location**: nav, .global-nav
- **elementType**: img, button
- **fallback**: Check if user profile photo/nav exists (indicates logged in)
- **confidence**: 0.9
