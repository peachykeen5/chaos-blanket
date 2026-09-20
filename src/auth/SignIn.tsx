import { Button, ChaosBlanketMark, InlineError } from "../components";
import { useAuth } from "./useAuth";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 18 18" className="h-[18px] w-[18px] shrink-0">
      <path
        fill="#fff"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62Z"
      />
      <path
        fill="#fff"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.81.54-1.84.86-3.06.86-2.35 0-4.34-1.58-5.05-3.71H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#fff"
        fillOpacity=".7"
        d="M3.95 10.71A5.4 5.4 0 0 1 3.66 9c0-.59.1-1.17.29-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04l2.99-2.33Z"
      />
      <path
        fill="#fff"
        fillOpacity=".85"
        d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l2.99 2.33C4.66 5.16 6.65 3.58 9 3.58Z"
      />
    </svg>
  );
}

export function SignIn() {
  const { error, signIn } = useAuth();

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#090514]">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#F36D00] to-[#B0176C] opacity-[0.59]" />
      <div className="pointer-events-none absolute -left-40 bottom-0 h-[500px] w-[500px] rounded-full bg-[#F36D00] opacity-40 blur-[120px]" />
      <div className="pointer-events-none absolute -right-20 top-0 h-[600px] w-[600px] rounded-full bg-[#B0176C] opacity-40 blur-[120px]" />

      <div className="relative mx-auto grid min-h-screen w-full max-w-7xl grid-cols-1 items-center gap-12 px-6 py-16 lg:grid-cols-2 lg:gap-16 lg:px-16">
        <div className="flex flex-col gap-8">
          <div className="flex items-center gap-3">
            <ChaosBlanketMark />
            <span className="text-lg font-bold text-white">Crochet Chaos</span>
          </div>

          <div className="flex flex-col gap-5">
            <h1 className="text-4xl font-extrabold leading-tight text-white sm:text-5xl">
              <span className="text-[#3DC1D3]">Chaos</span> never looked so
              Cozy
            </h1>
            <p className="max-w-md text-white">
              Crochet Chaos mixes up stitches, colors, and row counts so your
              next crochet project stays playful, surprising, and full of
              happy accidents.
            </p>
          </div>

          <div className="flex items-center gap-8">
            <div>
              <div className="text-2xl font-bold text-white">99.9%</div>
              <div className="text-sm text-[#A39EB9]">Cozy Uptime</div>
            </div>
            <div className="h-10 w-px bg-white/20" />
            <div>
              <div className="text-2xl font-bold text-white">250k+</div>
              <div className="text-sm text-[#A39EB9]">Threads Organized</div>
            </div>
          </div>
        </div>

        <div className="flex justify-center lg:justify-end">
          <div className="w-full max-w-md rounded-[32px] border border-white/10 bg-[#130E26]/70 p-8 shadow-2xl backdrop-blur-xl">
            <h2 className="text-2xl font-bold text-white">
              Get hooked on chaos.
            </h2>
            <p className="mt-2 text-sm text-white">
              Random stitches, colours, and rows for your one-of-a-kind
              blanket.
            </p>

            <button
              type="button"
              onClick={signIn}
              className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#4285F4] px-4 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#3574E0]"
            >
              <GoogleIcon />
              Sign in with Google
            </button>

            {error && (
              <InlineError className="mt-4 text-center">
                {error}{" "}
                <Button variant="link" size="md" onClick={signIn}>
                  Retry
                </Button>
              </InlineError>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
