import Image from "next/image";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { requireUser } from "@/lib/session";
import { NavLinks } from "./nav-links";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="flex flex-1 flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 btn-ink">
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-line bg-fog/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:gap-8 sm:px-6">
          <Link href="/dashboard" aria-label="Cadence home" className="shrink-0">
            <Logo />
          </Link>
          <NavLinks />
          <div className="ml-auto flex items-center gap-2">
            <Link href="/compose" className="btn-primary hidden sm:inline-flex">
              New post
            </Link>
            <details className="group relative">
              <summary
                className="flex cursor-pointer list-none items-center rounded-full p-0.5 ring-line hover:ring-2 [&::-webkit-details-marker]:hidden"
                aria-label="Account menu"
              >
                {user.avatarUrl ? (
                  <Image src={user.avatarUrl} alt="" width={32} height={32} className="rounded-full" />
                ) : (
                  <span className="grid size-8 place-items-center rounded-full bg-ink text-sm text-white">
                    {user.login[0]?.toUpperCase()}
                  </span>
                )}
              </summary>
              <div className="absolute right-0 mt-2 w-56 rounded-[14px] border border-line bg-paper p-1.5 shadow-[0_16px_40px_-16px_rgb(23_26_35/0.35)]">
                <p className="truncate px-3 py-2 text-sm text-mute">
                  Signed in as <span className="font-medium text-ink">@{user.login}</span>
                </p>
                <form action="/api/auth/logout" method="post">
                  <button className="btn-ghost w-full justify-start">Sign out</button>
                </form>
              </div>
            </details>
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        {children}
      </main>
    </div>
  );
}
