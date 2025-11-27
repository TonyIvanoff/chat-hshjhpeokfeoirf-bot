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

## 4. Configure Secrets
1. Go to your repository **Settings** tab.
2. Click **Secrets and variables** > **Actions** in the left sidebar.
3. Click **New repository secret**.
4. Name: `WEBHOOK_URL`
5. Value: Your actual n8n webhook URL (e.g., `https://n8n.antonasdev.space/webhook/abc/chat`).
6. Click **Add secret**.

## 5. Enable GitHub Pages
1. Go to your repository **Settings** tab.
2. Click **Pages** in the left sidebar.
3. Under **Build and deployment** > **Source**, select **GitHub Actions** (Beta) or ensure it's set to deploy from the workflow we created.
   *Note: Since we added a workflow file, GitHub might automatically detect it. If not, select "GitHub Actions".*

## 6. Verify Deployment
- Go to the **Actions** tab to see your deployment running.
- Once green, click the deploy job to find your site URL.

> [!IMPORTANT]
> **n8n Webhook CORS**: If your chat widget connects to n8n, ensure your n8n webhook node is configured to allow requests from your new GitHub Pages domain (e.g., `https://your-username.github.io`).
