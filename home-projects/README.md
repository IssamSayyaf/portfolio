# README

This folder contains the home page project cards data. Each project has its own subfolder with a `details.md` file.

## How to Add a New Project

1. Create a new folder for your project (e.g., `my-new-project/`)
2. Create a `details.md` file inside with your project content
3. Add an entry to `home-projects-data.json` with:
   - `id`: unique identifier (matches folder name)
   - `title`: project title
   - `description`: short description
   - `categories`: array of category tags
   - `keywords`: array of keyword tags
   - `image`: path to project image
   - `detailsFile`: path to details.md file
   - `order`: display order on home page

The project card will automatically appear on the home page!
