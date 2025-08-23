# Submission Voting Gallery for a Photography Competition
We wrapped up submission collection and it turned out that:
- We had data from a google forms sheet, downloaded it as a CSV
- We asked each user to upload 4 photographs per team and they all ended up in seperate folders. Google Forms CSV gave us a bunch of drive links! You need to ensure this folder is public, terrible for OPSEC, I know :(
    - We solved this problem with the previous repo: https://github.com/sounddrill31/MONO-gallery-submissions/blob/main/README.md
- We performed an in-person voting with a panel of Judges, reducing the 88 images(4 by each team) into 10 images(1 for each team). We used the MONO-gallery-submissions website for this. 

This website will help us circulate a form for this, facilitating a last-round student voting. 

This was our first event but we're gonna make it better!

This is a WIP project to turn a google forms link into a beautiful frontend website inspired by [MONO Design](https://mono.layogtima.com/) semi-automatically, with a little bit of manual work.


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