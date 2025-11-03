- start with website url --> crawl --> summarize into "Website Summary / Business Context". this field can be manually edited by user
- Website Summary/Business Context  --> list of top N keywords to rank for. what is the number N? also auto-include the low-medium difficulty, auto-exclude the high difficulty. user can manually add / remove individual keyword as they like
- list of top N keywords that is included in our article generation --> run cadence of : (1) auto-generate titles + outline + primary and secondary keywords for the next 30 days or everyday that user subscription is active (need entitlement check based on what is the last day of active subscription for the current active subscription). 
- round-robin on the included keywords, ignore excluded keywords. call the article status as "QUEUED". 
- start the clock based on current UTC timestamp. then have the next 3 days lookahead generate the full article, as "SCHEDULED". only when scheduled timestamp > current timestamp, make it "PUBLISHED". all these are automatic, not need for user approval. user can edit whenever it is "SCHEDULED" or "PUBLISHED". user can delete "QUEUED" or "SCHEDULED" articles, then the system rebalance by either generating title+outline or full article.


- all of these steps above are not automatic. website url --> website summary / busness context is automatic, but need user approval to generate keywords. then user can manually add / remove. and once user finished and approved, only start the cadence of article generation

the sidebar should be :
  Home (what is the website and the editable website summary / business context)
  Keyword (what are the generated keywors for the given website url)
  Calendar (calendar view of QUEUED/SCHEDULED/PUBLISHED articles)
  Articles (list view of QUEUED/SCHEDULED/PUBLISHED articles)
  Integrations (list view of integrations e.g., webhooks, webflow, wordpress,
  shopify, notion, framer, etc)
  Settings (account, billing, subscription, preferences, etc.)

```
