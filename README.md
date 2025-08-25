# Submission Voting Gallery for a Photography Competition
We wrapped up submission collection and it turned out that:
- We had data from a google forms sheet, downloaded it as a CSV
- We asked each user to upload 4 photographs per team and they all ended up in seperate folders. Google Forms CSV gave us a bunch of drive links! You need to ensure this folder is public, terrible for OPSEC, I know :(
    - We solved this problem with the previous repo: https://github.com/sounddrill31/MONO-gallery-submissions/blob/main/README.md
- We performed an in-person voting with a panel of Judges, reducing the 88 images(4 by each team) into 10 images(1 for each team). We used the MONO-gallery-submissions website for this. 
- We wanted to anonymize this data for impartial judging so there is a flag to hide team info, and go by the rank from the previous round('Position' element in the CSV)

This website will help us organize the entire event, from Sharing a Submission Link with a form, to facilitating a last-round student voting after a judging round happens on a different link. 

This was our first event but we're gonna make it better!

This is a WIP project to turn a google forms link into a beautiful frontend website inspired by [MONO Design](https://mono.layogtima.com/) semi-automatically, with a little bit of manual work.

If you wish to use this for your event, remember to edit [config.yaml](config.yaml)!

## Image Backends
> [!WARNING]
> The downloader script is hardcoded to account for google drive links. This may break at any time!

TODO: Add direct downloads or local file paths.

## Config

### Example teams.yaml
This will be automatically generated from data.csv
```yml
teams:
- teamName: Team 16
  team_number: '16'
  images:
  - image/16/Photo.avif
  description: Submission from N/A.
  rank: '1'
- teamName: Clicks by A,B&C
  team_number: '20'
  images:
  - image/20/Photo.avif
  description: Submission from N/A.
  rank: '2'
```

### Example CSV Scheme
```csv
Position,Team Number,Team Name,Submission Image,Final Round Public Voting Result(%)
```

> [!TIP]
> `Final Round Public Voting Result(%)` is only for the stats page and can be skipped 

### Results & Extra Statistics System

The site now supports an inline **Results Modal** (no separate stats page) that appears when:

1. `show_results: true` in `config.yaml`, and
2. The phase has advanced to results (after `voting_close`, or at `deadlines.results` if set).

Clicking the unified action button labeled `Results` opens a full-screen modal containing:

Order:
1. Winners (Top 3 cards with medal outline styles and public vote % if available)
2. Winner Gallery (all submissions sorted by public vote % descending, then rank)
3. Public Vote Distribution Pie Chart (if `Final Round Public Voting Result(%)` column present)
4. Extra Statistics (auto-generated cards/charts from specially named CSV columns)

#### Public Vote Percentages
If your CSV contains `Final Round Public Voting Result(%)`, each team's value is parsed as `public_vote_percent` and used for:
- Winner cards (shows e.g. `54.2% public vote` if numeric)
- Main public vote pie chart
- Sorting the Winner Gallery

If absent or non-numeric, related visualizations gracefully fallback with a notice.

#### Defining Extra Stats in CSV
You can add arbitrary statistics by creating columns whose headers follow this pattern:

`<Title>(extra stat)` optional `(pie|bar)` optional `(1)` / `(2)`

Breakdown:
- `(extra stat)` (case-insensitive) marks the column (or column group) for extraction.
- `(pie)` or `(bar)` tells the frontend which visualization to render. If omitted, a simple value card or list is produced.
- `(1)` and `(2)` designate pairing groups for label/value series (for pie or bar charts). Group 1 columns are treated as labels; corresponding Group 2 columns as numeric values (paired by index). If you omit groups, the system attempts a best-effort fallback, treating each column's row values as entries.

Examples:
1. Single Value Card:
  - Column: `Total Teams(extra stat)`
  - First non-empty row value becomes the displayed statistic.

2. Pie Chart (label/value pairs split across groups):
  - `Total Course-Wise Participation Distribution(extra stat)(pie)(1)`
  - `Total Course-Wise Participation Distribution(extra stat)(pie)(2)`
  - Each row: Group (1) cell = label, Group (2) cell = numeric value. Multiple rows accumulate slices.

3. Bar Chart (label/value pairs):
  - `Teams(extra stat)(bar)(1)`
  - `Teams(extra stat)(bar)(2)`
  - Row examples:
    - `Participated` / `22`
    - `Qualified` / `10`
    - `Awarded` / `4`

4. Pie Chart with Course Distribution:
  - `Total Course-Wise Participation Distribution(extra stat)(pie)(1)` (Labels: e.g. `BCA A 2nd Sem`)
  - `Total Course-Wise Participation Distribution(extra stat)(pie)(2)` (Values: e.g. `1`)

Notes & Rules:
- Title is everything before `(extra stat)`; trailing chart/group markers are stripped in the UI.
- Only the first non-empty value for a non-chart stat is used (assumes aggregate row). Keep such stats on a single summary row.
- For chart stats, every row containing both a label (group 1) and value (group 2) contributes a slice/bar.
- Non-numeric values in chart value positions are preserved as raw strings but may not render proportionally (bars/pies treat them as 0).
- All extracted stats are stored under `extra_stats` in `teams.yaml` and injected into the frontend config.

#### Styling & Accessibility
- Monochrome (grayscale) shades are auto-assigned to slices/bars for consistency with the MONO theme.
- Hover opacity change on pie slices for simple focus feedback.
- Winner medal styling hierarchy: double outline (🥇), solid (🥈), dashed (🥉).

#### Workflow
1. Add properly named `(extra stat)` columns to your CSV.
2. Run the generation pipeline (`pixi run prepare` or your script) to regenerate `teams.yaml`.
3. Open the site after results phase begins; click `Results`.

#### Troubleshooting
- If a stat doesn't appear: confirm the header includes `(extra stat)` and matches the grouping/chart syntax exactly.
- If pie/bar shows no slices: ensure both group (1) and group (2) variants exist and rows have data in both columns.
- Clear browser cache or regenerate if structure changes.

## Get Started
This project uses [Pixi](https://pixi.sh/latest/) to manage code, and scripts. 

### Install
Follow steps from the official page to install Pixi: https://pixi.sh/latest/installation/

Also ensure git is installed! 

### Set up project
```bash
git clone https://github.com/sounddrill31/MONO-gallery-vote && cd MONO-gallery-vote
```

### Install Dependencies/Environment

```bash
pixi install
```

### Serve
#### Option 1: Auto Serve (Development)
This uses http.server on 8000, and automatically starts a server after preparing `output/` folder.

```bash
pixi run start
```

#### Option 2: Manual Build(Production)
The following command downloads and prepares all pictures:
```bash
pixi run prepare
```

Now, output will be in `dist/` folder, which will contain your html, css, js code, along with images. Run a web server here or upload this folder to your VPS.
```bash
cd output
```

```bash
npx http-server
``` 

### Option 3: Quick Deploy with Cloudflare Pages(Production)
0. Fork this repo and make your changes
1. Go to https://dash.cloudflare.com and log in
2. Navigate to `Compute(Workers)` on Left Hand Menu
3. Click on it and open `Workers & Pages`, and click on Create
4. Switch to `Pages` tab as we do not want to create a Cloudflare Worker
5. Connect your repo to cloudflare using `Import an existing Git repository` and follow the process
  - For build command, use this:
    ```bash
    sed -i 's/your-form-id-submit/<putyoursubmitformidhere>/g' config.yaml && sed -i 's/your-form-id-voting/<putyourvotingformidhere>/g' config.yaml && curl -fsSL https://pixi.sh/install.sh | sh && export PATH="$HOME/.pixi/bin:$PATH" && $HOME/.pixi/bin/pixi install && $HOME/.pixi/bin/pixi run ci "<link to your data.csv on google sheets after cleaning up with the expected schema>"
    ```
  - For build output dir, use: `dist`
> [!WARNING]
> replace `<putyoursubmitformidhere>`, `<putyourvotingformidhere>` and `<link to your data.csv on google sheets after cleaning up with the expected schema>` appropriately. 

TODO: Improve this as it is a one-liner hack we came up with 5 min before class. 