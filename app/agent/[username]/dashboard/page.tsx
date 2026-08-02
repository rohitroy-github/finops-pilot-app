import LiveDashboard from "./live-dashboard";

type UserDashboardPageProps = {
  params: Promise<{
    username: string;
  }>;
};

export default async function UserDashboardPage({
  params,
}: UserDashboardPageProps) {
  const { username } = await params;

  return (
    <main className="min-h-screen bg-linear-to-b from-zinc-50 via-neutral-100 to-zinc-200 text-zinc-900 flex items-start justify-center px-6 pt-24 sm:pt-28">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-1 sm:px-2">
        <LiveDashboard username={username} />
      </div>
    </main>
  );
}
