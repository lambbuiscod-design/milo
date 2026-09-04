import Link from "next/link";
import { MiloCat } from "@/components/milo-cat";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-5 outline-none" id="main-content" tabIndex={-1}>
      <div className="text-center">
        <MiloCat className="mx-auto h-28 w-28" mood="thinking" />
        <h1 className="font-display mt-4 text-3xl font-semibold sm:text-4xl">This conversation wandered off.</h1>
        <p className="mt-3 text-sm text-[var(--muted)] sm:text-base">
          The page you are looking for does not exist or has moved.
        </p>
        <Link
          className="btn btn-primary premium-button mt-6 inline-flex min-h-12 items-center rounded-full px-6 font-extrabold text-white"
          href="/"
        >
          Back to Milo
        </Link>
      </div>
    </main>
  );
}
