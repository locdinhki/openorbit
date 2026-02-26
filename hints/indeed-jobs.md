---
site: indeed.com/jobs
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
- **fallback**: Navigate to Indeed job search URL with query parameters
- **confidence**: 0.9

### wait_for_results
- **selectors**: `#mosaic-jobResults`, `.jobsearch-ResultsList`, `[id='mosaic-provider-jobcards']`, `.resultContent`
- **textMatches**: (none)
- **ariaLabels**: (none)
- **location**: main
- **elementType**: container
- **fallback**: Wait for job search results container to appear
- **confidence**: 0.8

## extract_job_cards

### find_job_cards
- **selectors**: `.job_seen_beacon`, `.resultContent`, `.cardOutline`, `[data-jk]`, `li.css-1ac2h1y`
- **textMatches**: (none)
- **ariaLabels**: (none)
- **location**: #mosaic-jobResults, .jobsearch-ResultsList
- **elementType**: div, li
- **fallback**: Find all job card elements in search results
- **confidence**: 0.75

## extract_card_title

### get_job_title
- **selectors**: `.jobTitle a`, `h2.jobTitle span`, `a[data-jk] span[title]`, `.jcs-JobTitle span`
- **textMatches**: (none)
- **ariaLabels**: (none)
- **location**: .resultContent
- **elementType**: a, span
- **fallback**: Extract job title text from card
- **confidence**: 0.8

## extract_card_company

### get_company_name
- **selectors**: `[data-testid='company-name']`, `.companyName`, `.company_location .companyName`, `span.css-92r8pb`
- **textMatches**: (none)
- **ariaLabels**: (none)
- **location**: .resultContent
- **elementType**: span
- **fallback**: Extract company name from card
- **confidence**: 0.75

## extract_card_location

### get_job_location
- **selectors**: `[data-testid='text-location']`, `.companyLocation`, `.company_location .companyLocation`, `.css-1p0sjhy`
- **textMatches**: (none)
- **ariaLabels**: (none)
- **location**: .resultContent
- **elementType**: div, span
- **fallback**: Extract location from card metadata
- **confidence**: 0.75

## extract_job_details

### get_job_description
- **selectors**: `#jobDescriptionText`, `.jobsearch-JobComponent-description`, `[id='jobDescriptionText']`, `.jobsearch-jobDescriptionText`
- **textMatches**: (none)
- **ariaLabels**: (none)
- **location**: .jobsearch-ViewJobLayout, #viewJobSSRRoot
- **elementType**: div
- **fallback**: Extract full job description from detail panel
- **confidence**: 0.8

### get_detail_salary
- **selectors**: `#salaryInfoAndJobType`, `[data-testid='attribute_snippet_testid']`, `.salary-snippet-container`, `.css-1bkk2ja`
- **textMatches**: `$`, `/yr`, `/hr`, `per hour`, `per year`, `a year`, `an hour`
- **ariaLabels**: (none)
- **location**: .jobsearch-ViewJobLayout
- **elementType**: div, span
- **fallback**: Extract salary info from detail panel
- **confidence**: 0.6

## next_page

### click_next_page
- **selectors**: `a[data-testid='pagination-page-next']`, `.np[aria-label='Next Page']`, `nav[aria-label='pagination'] a:last-child`
- **textMatches**: (none)
- **ariaLabels**: `Next Page`, `Next`
- **location**: nav[aria-label='pagination']
- **elementType**: a
- **fallback**: Click next page link in pagination
- **confidence**: 0.75
