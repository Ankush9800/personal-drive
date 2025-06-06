This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Cloudflare Pages

This app is designed to be deployed on Cloudflare Pages with direct R2 storage integration.

### Required Environment Variables

Set these environment variables in your Cloudflare Pages project settings:

- `R2_ACCESS_KEY_ID`: Your R2 access key ID
- `R2_SECRET_ACCESS_KEY`: Your R2 secret access key
- `R2_ENDPOINT`: Your R2 endpoint URL (e.g., `https://<account-id>.r2.cloudflarestorage.com`)
- `R2_BUCKET_NAME`: Your R2 bucket name (default: "drive")
- `AUTH_SECRET_KEY`: A random string for session encryption

### Deployment Steps

1. Push your code to a Git repository
2. In Cloudflare Pages:
   - Connect your repository
   - Set build command: `npm run build`
   - Set build output directory: `.next`
   - Set Node.js version: 20.x
3. Configure environment variables in the Cloudflare dashboard
4. Deploy!
