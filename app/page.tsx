import Image from "next/image";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-center gap-12 py-32 px-16 bg-white dark:bg-black">
        <Image
          src="/lightsprint-logo.svg"
          alt="Lightsprint logo"
          width={64}
          height={66}
          priority
        />
        <div className="flex flex-col items-start gap-6 text-left">
          <h1 className="max-w-md self-center text-center text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
            Lightsprint Next.js starter.
          </h1>
          <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Plan visually, preview live, ship production-ready code.
            <br />
            <br />
            Spin up your next Lightsprint app from this template to start
            sprinting.
          </p>
        </div>
      </main>
    </div>
  );
}
