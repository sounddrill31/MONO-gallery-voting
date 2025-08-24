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
Position,Team Number,Team Name,Submission Image
```

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