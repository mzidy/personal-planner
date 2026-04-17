<template>
  <div class="min-h-screen bg-background px-5 py-6 md:px-8 lg:px-10">
    <div class="mx-auto flex min-h-[calc(100vh-3rem)] max-w-7xl items-stretch overflow-hidden rounded-[2.5rem] bg-executive-panel shadow-ambient">
      <section class="relative hidden flex-1 overflow-hidden bg-executive-dark px-10 py-12 text-white lg:flex lg:flex-col">
        <div class="absolute inset-0 bg-executive-glow opacity-70" />
        <div class="relative z-10 flex h-full flex-col justify-between">
          <div>
            <p class="text-sm uppercase tracking-[0.24em] text-white/70">The Serene Executive</p>
            <h1 class="mt-8 max-w-lg font-display text-5xl font-extrabold tracking-[-0.06em]">
              Calm command over your focus, time, and money.
            </h1>
            <p class="mt-6 max-w-xl text-lg leading-8 text-white/72">
              Built as a private executive workspace with deliberate routines, deep-work visibility,
              and a manual money ledger that never loses the signal.
            </p>
          </div>

          <div class="grid gap-4">
            <div class="rounded-panel border border-white/10 bg-white/6 p-6 backdrop-blur">
              <p class="eyebrow text-white/60">Production baseline</p>
              <p class="mt-3 text-2xl font-display font-bold">OAuth, session sealing, audit trail.</p>
            </div>
            <div class="rounded-panel border border-white/10 bg-white/6 p-6 backdrop-blur">
              <p class="eyebrow text-white/60">Main focus</p>
              <p class="mt-3 text-lg leading-7 text-white/76">
                Time blocks, focus sessions, diary capture, and goal visibility are the center of the
                product, not finance noise.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section class="flex w-full items-center justify-center bg-background px-6 py-10 md:px-10 lg:max-w-[34rem]">
        <div class="w-full max-w-md">
          <slot />
        </div>
      </section>
    </div>
  </div>
</template>
