export default function PlaceholderPage({
  title,
}: {
  title: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-10 shadow-sm">
      <h1 className="text-3xl font-bold text-slate-900">
        {title}
      </h1>

      <p className="mt-3 text-slate-500">
        Module en cours de développement.
      </p>
    </div>
  );
}