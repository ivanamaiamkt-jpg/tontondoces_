export function CategoryBanner({
  title,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-2 py-3 text-center sm:py-5">
      <h2 className="font-display text-2xl leading-tight text-primary sm:text-3xl">
        {title}
      </h2>
      <span className="block h-px w-16 bg-gold/70" />
    </div>
  );
}
