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

## Development Features

### Auth Guard Override

For development and testing purposes, you can disable authentication guards to access protected routes (like Inventory and Forms) without logging in.

**To disable auth guards:**

1. Open `apps/frontend/.env`
2. Set `NEXT_PUBLIC_DISABLE_AUTH_GUARD=true`
3. Restart your development server

```bash
# In .env file
NEXT_PUBLIC_DISABLE_AUTH_GUARD=true
```

**Important Notes:**
- This flag bypasses both `ProtectedRoute` (authentication check) and `OrgGuard` (organization check)
- **Only use this in development environments**
- Never deploy to production with this flag enabled
- Set back to `false` when testing actual authentication flows

**Affected Routes:**
- `/inventory` - Inventory management page
- `/forms` - Forms management page
- Any other route wrapped with `ProtectedRoute` or `OrgGuard`

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
