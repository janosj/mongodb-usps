# Demo Read-Aloud Script: Catching Fraud, Waste, and Abuse

Nov 17, 2026 · @Jonathan Janos

Read the plain text aloud. Every **\[bold bracket\]** is something you do, not something you say. About 8 minutes.

## Before you start

- **\[Check\]** The app is open on tab 1, and the scan feed is paused.
- **\[Click Reset Demo Data\]** and wait for the checkmark.

## Open (0:00)

**\[Switch to slide: Demo: From Surge to Lead Packet\]**

Let's see this working. All the data is simulated. Three parts: fast, smart, flexible.

## Part 1: Be fast (0:30)

Picture scans arriving from facilities all over the country, roughly 3,500 pieces a second on average. Here they're simulated, one per label. Every scan needs a decision, right away. Watch the decision time on each one, and watch the colors.

**\[Switch to the demo app, tab 1\]**

**\[Click "Acceptance Scans - Start Feed"\]**

These scans are all honest mail, i.e. the label is real and the postage is paid. The label came from a post office, a USPS online tool, or a shipping platform that buys postage through USPS. The payment is behind it: cash or card at the counter, or, for big shippers, a funded account with USPS.

Each scan gets one of three decisions: release, review, or hold. To decide, the system pulls the account's data from MongoDB, applies some rules or business logic, and saves the decision back to the database, alongside the scan data. The time it took is shown beside each one. Nearly all are released.

Each of these simulates an acceptance scan, i.e. the first time USPS takes in a package. Click **"Show code" **to see what's being executed: an update adds the label's postage to the account's running total and gets the new total back in the same call. An application-level function ("decide") is called to make the determination, and the label is saved with its decision. This split is intentional. MongoDB keeps the data current and fast to reach. The decision logic lives in the application, where your team can change it. You could replace `decide()` with a rules engine, a scoring model, or a call to another service, and the MongoDB part would stay the same. Where do the fraud rules live? They live in your code. MongoDB is where they read from and write to.

**\[Click "Inject counterfeit surge"\]**

Now some bad actor starts issuing fraudulent labels associated with Mailer ID **902144201** - Lakeside Fulfillment. The exact methods are redacted in the public reports, but either the labels themselves have been doctored, or they're tied to an account that never pays.&#32;

A "**Review**" decision indicates a weight mismatch, which shows up immediately in the counterfeit labels.&#32;

A "**Hold**" decision happens once the exposure on the account passes three times its own normal. The mail never slowed down. Every millisecond we save on data retrieval is a millisecond left for the fraud rules.

**Point at the account status under the chart: **The account itself just moved out of good standing, without anyone running a report.

**Where's the data? **Check the *.env* file for any changes, but as initially designed the package scans are stored in the *pieces* collection and the account overages are updated in *accounts*.

---

## Part 2: Be smart (2:30)

The system caught it. Now, what's behind it? Watch what keyword search misses.

**\[Switch to the demo app, tab "Be smart: Investigate"\]**

**\[Click the flagged account\]**

A spike in time, and a cluster near Chicago. The counts for the bar chart come from *scan\_metrics*, where the time series data is organized by *mailerID*. The geo data is stored with the scans in the *pieces *collection. Both questions run on the same database, in the same query language, against data the scans already wrote. There’s no separate time-series database or mapping system to feed.

None of the dots come from a geo query. The **gray dots** are packages that weren't flagged: a random sample of 300 packages from all mailers (no geo filter). The **red dots** are this mailer’s packages from the last 30 minutes (up to 400) whose decision was review or hold. That's an ordinary lookup by mailer ID and time (also no geo filter). The dashed red ring is drawn on the map for illustration, centered on the home facility at the 25-mile radius. It isn’t returned by a query.&#32;

Geo queries are only used in the sentence above the map: “N of this account’s recent scans fall within 25 miles of Chicago, against M from every other account.” Those two numbers are the geo queries. The database finds the packages inside the circle using a geospatial index and returns a count, so the backend doesn’t have to pull thousands of coordinates and do the distance math itself.

In short: The dots are the scans. The geo query counts how many fall inside this circle.

**\[Click the chip "counterfeit label"\]**

Up to now the system has given you numbers, a spike, and a place. An investigator’s next question is: what people are saying about it? It's pretty realistic to have a bunch free text that piles up across channels, without anyone having tagged it as fraud. Postal Inspectors, carriers (i.e. employees), and customers report problems in their own words. These three report categories (**inspector**, **carrier**, or **customer**)** **are labeled on the cards. These are all stored in the *tips* collection.

1. **Run the search.** Same phrase, two methods, side by side. “These are reports from inspectors, carriers, and customers: free text, in their own words, with plenty of unrelated noise mixed in. All of it is synthetic.”
2. **Show what keyword missed.** Point at the right-hand column. No one wrote “counterfeit label.” They wrote “photocopied barcode,” “slip the counter couldn’t validate,” and “postage that failed validation.” These are all the same problem.
3. **Show the false positive.** Keyword also matched a couple of unrelated reports about return labels. Matching words isn’t the same as matching meaning.
4. **Name what the AI did.** It found the related reports. It decided nothing. A person still draws the conclusion.

Same reports, searched two ways. One matched words. The other matched meaning.

**\[Click "Draft lead packet"\]**

The packet assembles itself from the evidence, with its sources cited.

In the default setup no AI model writes it (see code in `backend/lib/leads.js`). It fills in a template with the numbers, so the result is instant and no model is involved. If `LEAD_MODE=llm` is set, it sends the same evidence to an OpenAI model to write 4-6 sentences using only that evidence, and falls back to the template if that fails.

**It saves the packet as a DRAFT** in the `leads` collection, with the evidence, the text, and the cited report IDs. A second click returns the saved one and labels it “generated earlier.” **Redraft** rebuilds it. **"Approve as inspector" **changes the status to APPROVED and records who approved it and when. Nothing else happens. The demo has no case or downstream system. For the story: the packet pulls together the numbers, the place, the device, and related reports into one record with its sources listed, and a person has to approve it. In default mode, “assembled from the evidence” is the accurate phrase, not “AI wrote it.”

## Part 3: Stay flexible (5:30)

Incoming data can change shape while the system keeps running. The upstream feed adds two fields, nothing on your side is touched, and the database stores them and answers questions about them right away.

**\[Switch to the demo app, tab "Stay flexible: Evolving data feeds"\]**

The JSON displayed here is stored in the *pieces* collection. Make sure the feed is started on Tab 1, and the JSON will continually update!

**\[Click "Upstream system upgrades to v2 (new fields)"\]**

**\[Wait about 4 seconds\]**

Two new fields! No migration, no restart, no code change! Click **Roll Back** and the previous V1 data shape is used once again, going forward.&#32;

There are a few things to look at:

- The new V2 shape shows up in the JSON panel, with the new fields highlighted. This part works best if you scroll down a little bit in the JSON window. That will ensure that the new fields are visible when they start coming in.&#32;
- The lower left has a table that indicates what percentage of the last 500 records has the new fields. This was added dynamically. If you roll back, the numbers with drift back down.&#32;
- The “Ask about the new field” table groups is aggregating records by `device_id`, which doesn't even exist in V1. The counterfeit labels in the surge share one device, D-4471, so it rises to the top with the most flagged labels. That query works at once, with no migration and no new index. **This is the payoff**: a field that didn’t exist a minute ago already answers a fraud question. **For this part to work, the Fraud Surge has to be active.  **The generator sends about 90% of the counterfeit labels through the one device, D-4471, and gives the other 10% a random device ID (`D-1000` through `D-3999`). So a few other devices pick up one or two flagged labels each. That was done intentionally, so the story doesn’t claim the fraud lives on a single device. (The device is the scanner).&#32;

**Schema Validation: **Use **"Apply required-field guardrail"** and **"Send an incomplete record"** to demonstrate. Flexible where you want it, strict where you need it. Note: the code snippet shows you what rules are enforced. The incomplete record doesn't include "scans", which is a required field that needs to be an array with at least one element. You can see the rules using Compass, but note you might have to disconnect from your cluster and reconnect in order to refresh the metadata.&#32;
