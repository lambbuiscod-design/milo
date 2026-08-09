import Link from "next/link";
import { MiloCat } from "@/components/milo-cat";
export default function NotFound() { return <main className="grid min-h-screen place-items-center px-5 outline-none" id="main-content" tabIndex={-1}><div className="text-center"><MiloCat className="mx-auto h-28 w-28" mood="thinking" /><h1 className="font-display text-4xl font-semibold">This conversation wandered off.</h1><Link className="mt-6 inline-flex min-h-12 items-center rounded-full bg-[var(--brand-fill)] px-6 font-extrabold text-white" href="/">Back to Milo</Link></div></main>; }
