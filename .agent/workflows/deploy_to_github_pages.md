---
description: How to deploy this project to GitHub Pages
---

# Deploy to GitHub Pages

Follow these steps to publish your website to GitHub Pages.

## 1. Initialize Git Repository
If you haven't already, initialize git in your project folder:
```bash
git init
git add .
git commit -m "Initial commit: Ready for deployment"
```

## 2. Create a GitHub Repository
1. Go to [github.com/new](https://github.com/new).
2. Name your repository (e.g., `abc-moving-site`).
3. Make it **Public** (required for free GitHub Pages).
4. Do **not** initialize with README, .gitignore, or License (since you have local files).
5. Click **Create repository**.

## 3. Push Code to GitHub
Copy the commands shown on GitHub under "…or push an existing repository from the command line" and run them in your terminal. They will look like this:
```bash
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/REPO_NAME.git
git push -u origin main
```

## 4. Enable GitHub Pages
1. Go to your repository **Settings** tab.
2. Click **Pages** in the left sidebar.
3. Under **Build and deployment** > **Source**, select **Deploy from a branch**.
4. Under **Branch**, select **main** and folder **/(root)**.
5. Click **Save**.

## 5. Verify Deployment
- Wait a minute or two.
- Refresh the Pages settings page.
- You will see a link at the top: "Your site is live at..."
- Click it to verify your site is working!

> [!IMPORTANT]
> **n8n Webhook CORS**: If your chat widget connects to n8n, ensure your n8n webhook node is configured to allow requests from your new GitHub Pages domain (e.g., `https://your-username.github.io`).
