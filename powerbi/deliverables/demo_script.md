# 8-minute demo script: IPL Auction Value Intelligence

**Setting:** you are a franchise analytics team briefing the owner before the next auction. Every page ends in a decision.
**Before you start:** open the `.pbix`, set the Season slicer to **2026**, and close the Filters pane.

| Time | Page | What to click | What to say |
| --- | --- | --- | --- |
| 0:00–0:45 | **Hook** (Home) | Nothing yet | "At the 2026 auction KKR paid ₹25.20 crore for Cameron Green, the most ever paid for an overseas player. Was he worth it? We scored every IPL auction buy since 2013 on what it delivered on the field per crore." |
| 0:45–2:15 | **4 Steals and Overpaid** | Ctrl+click the *Steals* pill in the top bar (or the 04 card) | "Start with the answer. In 2026, Kartik Tyagi cost ₹30 lakh and returned 34× fair value. Rishabh Pant cost ₹27 crore and was overpaid by ₹19.5 crore. Green: overpaid by ₹14.2 crore. All five most overpaid 2026 players cost ₹14 crore or more." Point at the **Bargain XI** and **Overpaid XI**. On the left: "Teams let Karn Sharma, Deepak Hooda and Jonny Bairstow go unsold." |
| 2:15–3:00 | **7 Player Profile** | Right-click *Cameron Green* → Drill through → Player Profile | "Season by season: price bars against the Impact Points line. 2023 at MI and 2026 at KKR are both Stars by output, but at ₹25 crore the Value Index is 0.44." Click **← Back**. |
| 3:00–3:45 | **3 Player Value Map** | *Value Map* pill | "Every buy as a dot: price across, Impact Points up, dashed lines at the season medians. Green Steals sit top-left. The red Overpaid and grey Passengers are the release shortlist." Hover a dot to show the tooltip card. |
| 3:45–4:45 | **2 Franchise Efficiency** | *Franchises* pill | "Value Index 1.00 is fair value. In 2026 RR got 1.63× from ₹34 crore; PBKS spent the most, ₹108 crore, for 0.72×. Across 123 team-seasons, spend is unrelated to win % (r = −0.03) but Value Index is not (r = +0.35). Money does not buy wins; value does." |
| 4:45–5:30 | **1 Auction Market** | *Market* pill | "Prices have doubled since 2013: ₹1.7 crore per buy then, ₹3.5 crore at the 2025 mega auction. Bars mark the mega auctions. In 2025–26 teams paid 245% over base price on average." |
| 5:30–6:15 | **5 Role and Nationality** | *Roles* pill | "Overseas buys cost 2.4× as much in 2026 but returned less per crore, 0.88 against 1.11. Over 14 years, Indian bowlers are the best-value role and overseas bowlers the worst." |
| 6:15–7:00 | **6 Price Brackets** | *Brackets* pill; set Season to all seasons | "This is the whole story in one chart: base-price buys return 4.1× fair value per crore; ₹10 crore-plus signings return 0.49×. Marquee players do beat median impact 88% of the time. They win games, but each crore buys far more in the cheap brackets." |
| 7:00–7:40 | **8 Methodology** | *Method* pill (or the i button) | "One score for bat, ball and field: a run is 1, a wicket 25, a catch 8, a stumping 12. Value Index compares each player's share of output with his share of spend, season by season. 99% of auction spend is matched to ball-by-ball data. Retained players are excluded because they have no auction price." |
| 7:40–8:00 | **Close** | *Home* pill | "Recommendation for the next auction: keep the Steals, release the Overpaid, spend overseas slots only on proven match-winners, and fill depth from the base-price pool." |

**Likely examiner questions**

- *Why these Impact Points weights?* They are fantasy-style weights. The same players top the runs-only and wickets-only views, so the conclusions hold.
- *What about retained players like Kohli?* They have no auction price, so they are labelled Unpriced and excluded from value measures. Their stats still show on the profile page.
- *Why is a ₹30 lakh player's Value Index above 20?* Value Index is a ratio. Tiny prices make it large, which is why the Overpaid views rank by crores lost (Overpay Cr) instead.
- *How do you know the data is right?* Show the hidden QA page (right-click the page tabs → Unhide). Orange and Purple Caps match the official winners, the 2026 auction totals 77 players for ₹215 crore, and league Value Index is exactly 1.00 every season.
