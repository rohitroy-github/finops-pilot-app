export default function UsecasesPage() {
  return (
    <main className="min-h-screen bg-linear-to-b from-zinc-50 via-neutral-100 to-zinc-200 text-zinc-900 px-6 py-24">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 rounded-2xl border border-black/10 bg-white/70 p-8 shadow-lg shadow-black/10 backdrop-blur">
        <h1 className="text-3xl font-bold tracking-tight">Usecases</h1>
        <p className="text-sm text-zinc-600">
          This page will list supported FinOps automation use cases.
        </p>
      </div>
    </main>
  );
}
