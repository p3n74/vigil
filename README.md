# UI/UX Template

A modern, production-ready fullstack monorepo template. This project is designed to be a starting point for building scalable applications with a focus on great developer experience and clean UI/UX.

## 🚀 Tech Stack

- **Framework**: [React](https://reactjs.org/) (Web) & [Expo](https://expo.dev/) (Native)
- **Monorepo Management**: [Turborepo](https://turbo.build/)
- **API Layer**: [tRPC](https://trpc.io/) for end-to-end type safety
- **Database**: [Prisma](https://www.prisma.io/) with PostgreSQL
- **Authentication**: [Better-Auth](https://better-auth.com/)
- **Router**: [TanStack Router](https://tanstack.com/router)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) & [shadcn/ui](https://ui.shadcn.com/)
- **State Management**: [TanStack Query](https://tanstack.com/query)
- **Runtime**: [Bun](https://bun.sh/)

## 📁 Project Structure

```
├── apps/
│   ├── web/        # React + Vite web application
│   ├── native/     # Expo / React Native mobile application
│   └── server/     # Express backend server
├── packages/
│   ├── api/        # Shared tRPC router definitions and logic
│   ├── auth/       # Authentication configuration
│   ├── db/         # Prisma schema and database client
│   ├── config/     # Shared configuration (TSConfig, Biome)
│   └── env/        # Type-safe environment variable management
```

## 🛠️ Getting Started

### Prerequisites

- [Bun](https://bun.sh/) installed on your machine.
- A PostgreSQL database (local or hosted).

### Installation

1. Clone this repository.
2. Install dependencies:
   ```bash
   bun install
   ```
3. Copy the environment variables:
   ```bash
   cp .env.example .env
   # Also copy .env.example in apps/server/ and apps/web/ if needed
   ```
4. Set up the database:
   ```bash
   bun run db:push
   ```

### Development

Start the development servers (web and server):
```bash
bun run dev
```

To run specifically:
- `bun run dev:web`: Start only the web app
- `bun run dev:server`: Start only the backend server
- `bun run dev:native`: Start the mobile app

## 🛡️ Authentication & Authorization

This template uses **Better-Auth** for secure authentication. 
It includes a generic role-based authorization system:
- **Whitelisted Access**: Only users added to the `AuthorizedUser` table can access protected data.
- **Roles**: Supports `ADMIN` and `USER` roles out of the box.

## 📡 API Development

API routes are defined in `packages/api/src/routers`. 
- Add new procedures to `index.ts` or create new router files.
- Procedures can be `public`, `protected` (auth required), `whitelisted` (approved user), or `admin`.

## 🎨 UI & Components

We use **shadcn/ui**. Components are located in `apps/web/src/components/ui`. 
To add new components:
```bash
cd apps/web
bun x shadcn@latest add [component-name]
```

## 📄 License

This project is licensed under the MIT License.
